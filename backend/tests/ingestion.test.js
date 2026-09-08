import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// The ingestion pipeline calls out to OpenAI for embeddings. Tests mock that
// module boundary so the suite runs deterministically with no network access
// or API key, while every other part of the pipeline (parsing, chunking,
// Mongo, the vector store) runs for real.
vi.mock('../src/services/embedding.service.js', () => ({
  embedTexts: vi.fn(async (texts) => texts.map((_, i) => [i, i + 1, i + 2, i + 3])),
}));

const { default: app } = await import('../src/app.js');
const { Chunk } = await import('../src/models/Chunk.js');
const { default: vectorStore } = await import('../src/models/vectorStore/index.js');

let counter = 0;
async function signupAndLogin() {
  counter += 1;
  const email = `ingest-user${counter}@example.com`;
  const password = 'password123';
  const tenantName = `Ingest Tenant ${counter}`;

  await request(app).post('/api/auth/signup').send({ email, password, tenantName });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body; // { token, user: { id, email, tenantId } }
}

describe('POST /api/documents/upload', () => {
  it('parses, chunks, embeds, and dual-writes a plain text upload', async () => {
    const { token, user } = await signupAndLogin();
    const fileContent = 'The quick brown fox jumps over the lazy dog. '.repeat(60);

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(fileContent), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(201);
    expect(res.body.document.status).toBe('ready');
    expect(res.body.document.chunkCount).toBeGreaterThan(0);

    const chunks = await Chunk.find({ tenantId: user.tenantId });
    expect(chunks).toHaveLength(res.body.document.chunkCount);
    expect(chunks[0].sourceFilename).toBe('notes.txt');

    const vectors = await vectorStore.findByTenant(user.tenantId);
    expect(vectors).toHaveLength(res.body.document.chunkCount);
  });

  it('rejects an upload with no file', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).post('/api/documents/upload').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('rejects an upload with no Authorization header', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .attach('file', Buffer.from('hello world'), { filename: 'hi.txt', contentType: 'text/plain' });
    expect(res.status).toBe(401);
  });

  it('rejects an unsupported file type', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'image.png', contentType: 'image/png' });
    expect(res.status).toBe(415);
  });

  it('rejects an upload attempting to override tenantId via a form field', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('tenantId', '000000000000000000000000')
      .attach('file', Buffer.from('hello world'), { filename: 'hi.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  it('rejects an upload attempting to override tenant_id (snake_case) via a form field', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('tenant_id', '000000000000000000000000')
      .attach('file', Buffer.from('hello world'), { filename: 'hi.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/documents', () => {
  it('lists this tenant\'s uploaded documents, newest first', async () => {
    const { token } = await signupAndLogin();

    await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('First document.'), { filename: 'first.txt', contentType: 'text/plain' });
    await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('Second document.'), { filename: 'second.txt', contentType: 'text/plain' });

    const res = await request(app).get('/api/documents').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(2);
    expect(res.body.documents[0].filename).toBe('second.txt');
    expect(res.body.documents[1].filename).toBe('first.txt');
    expect(res.body.documents[0].status).toBe('ready');
    expect(res.body.documents[0].chunkCount).toBeGreaterThan(0);
  });

  it('returns an empty list for a tenant with no documents', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).get('/api/documents').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([]);
  });

  it('never lists another tenant\'s documents', async () => {
    const tenantA = await signupAndLogin();
    const tenantB = await signupAndLogin();

    await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .attach('file', Buffer.from('Tenant A only.'), { filename: 'a-only.txt', contentType: 'text/plain' });

    const res = await request(app).get('/api/documents').set('Authorization', `Bearer ${tenantB.token}`);
    expect(res.body.documents).toEqual([]);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });
});

describe('tenant isolation at the storage layer (before retrieval exists)', () => {
  it('a direct MongoDB and vector-store query filtered by another tenant_id returns nothing', async () => {
    const tenantA = await signupAndLogin();
    const tenantB = await signupAndLogin();

    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .attach('file', Buffer.from('Tenant A secret document contents.'), {
        filename: 'secret.txt',
        contentType: 'text/plain',
      });

    expect(uploadRes.status).toBe(201);
    const { chunkCount } = uploadRes.body.document;
    expect(chunkCount).toBeGreaterThan(0);

    // MongoDB: querying by the owning tenant sees the chunks; querying by any
    // other tenant_id sees none of them.
    const chunksForOwner = await Chunk.find({ tenantId: tenantA.user.tenantId });
    const chunksForOther = await Chunk.find({ tenantId: tenantB.user.tenantId });
    expect(chunksForOwner).toHaveLength(chunkCount);
    expect(chunksForOther).toHaveLength(0);

    // Vector store: same guarantee.
    const vectorsForOwner = await vectorStore.findByTenant(tenantA.user.tenantId);
    const vectorsForOther = await vectorStore.findByTenant(tenantB.user.tenantId);
    expect(vectorsForOwner).toHaveLength(chunkCount);
    expect(vectorsForOther).toHaveLength(0);
  });
});
