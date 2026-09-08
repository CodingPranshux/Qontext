import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Retrieval calls out to OpenAI (query embedding) and Cohere (reranking).
// Tests mock both module boundaries so the suite is deterministic with no
// network access or API keys, while parsing, chunking, MongoDB, the vector
// store, BM25, and RRF all run for real.
//
// The embeddings below are deliberately adversarial: the query "refund
// policy" is made to embed suspiciously close to an *irrelevant* chunk, on
// purpose, so the test can show hybrid search + rerank correcting a mistake
// that a vector-only search would make. Real embeddings wouldn't normally
// misfire this way, but the pipeline has to be robust to it regardless.
const { embedTextsMock, rerankMock, TEXT } = vi.hoisted(() => {
  const TEXT = {
    refundPolicy: 'Our refund policy allows returns within 30 days.',
    earnings: 'The quarterly earnings report exceeded expectations this quarter.',
    shippingRefund: 'Shipping delays affected refund processing times last month.',
    query: 'refund policy',
  };

  const FAKE_EMBEDDINGS = {
    [TEXT.refundPolicy]: [1, 0, 0, 0],
    [TEXT.earnings]: [0, 1, 0, 0],
    [TEXT.shippingRefund]: [1, 0.1, 0, 0],
    [TEXT.query]: [0, 1, 0, 0], // matches the *earnings* chunk, not either refund chunk
  };

  const embedTextsMock = vi.fn(async (texts) => texts.map((t) => FAKE_EMBEDDINGS[t] || [0, 0, 0, 1]));

  // Stand-in cross-encoder: unlike the fake embeddings, this one actually
  // reads the text, so it corrects the vector search's mistake.
  const rerankMock = vi.fn(async ({ documents, topN }) => {
    const scored = documents.map((doc) => ({
      ...doc,
      rerankScore: doc.text.toLowerCase().includes('refund') ? 1 : 0.1,
    }));
    scored.sort((a, b) => b.rerankScore - a.rerankScore);
    return scored.slice(0, topN);
  });

  return { embedTextsMock, rerankMock, TEXT };
});

vi.mock('../src/services/embedding.service.js', () => ({ embedTexts: embedTextsMock }));
vi.mock('../src/services/reranker.service.js', () => ({ rerank: rerankMock }));

const { default: app } = await import('../src/app.js');
const { Chunk } = await import('../src/models/Chunk.js');
const { default: vectorStore } = await import('../src/models/vectorStore/index.js');

let counter = 0;
async function signupAndLogin() {
  counter += 1;
  const email = `retrieval-user${counter}@example.com`;
  const password = 'password123';
  const tenantName = `Retrieval Tenant ${counter}`;

  await request(app).post('/api/auth/signup').send({ email, password, tenantName });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body; // { token, user: { id, email, tenantId } }
}

async function uploadText(token, filename, content) {
  const res = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from(content), { filename, contentType: 'text/plain' });
  expect(res.status).toBe(201);
  return res.body.document;
}

describe('POST /api/query/search', () => {
  it('rejects a search attempting to override tenantId via the request body', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'anything', tenantId: '000000000000000000000000' });

    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated search', async () => {
    const res = await request(app).post('/api/query/search').send({ query: 'anything' });
    expect(res.status).toBe(401);
  });

  it('rejects a search with no query', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).post('/api/query/search').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it('never returns another tenant\'s chunks, even for an identical query', async () => {
    const tenantA = await signupAndLogin();
    const tenantB = await signupAndLogin();

    await uploadText(tenantA.token, 'refund.txt', TEXT.refundPolicy);

    const res = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ query: TEXT.query });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('hybrid search + RRF + rerank surfaces the relevant chunk that vector-only search would have missed', async () => {
    const tenant = await signupAndLogin();

    await uploadText(tenant.token, 'refund-policy.txt', TEXT.refundPolicy);
    await uploadText(tenant.token, 'earnings.txt', TEXT.earnings);
    await uploadText(tenant.token, 'shipping.txt', TEXT.shippingRefund);

    const earningsChunk = await Chunk.findOne({ tenantId: tenant.user.tenantId, sourceFilename: 'earnings.txt' });

    // Baseline: vector-only search against the same (adversarial) query embedding.
    const vectorOnly = await vectorStore.queryTopK({
      tenantId: tenant.user.tenantId,
      embedding: [0, 1, 0, 0],
      topK: 1,
    });
    expect(vectorOnly[0].chunkId).toBe(earningsChunk._id.toString());

    // Hybrid + RRF + rerank, via the real endpoint.
    const res = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({ query: TEXT.query });

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);

    const topResult = res.body.results[0];
    expect(topResult.text.toLowerCase()).toContain('refund');
    expect(topResult.chunkId).not.toBe(earningsChunk._id.toString());
  });
});
