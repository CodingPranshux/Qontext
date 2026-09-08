import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Every text embeds identically here on purpose — this is what lets two
// *textually different* queries below prove a semantic (not exact-string)
// cache hit: same embedding in, same cache entry found, regardless of the
// literal query string.
const embedTextsMock = vi.fn(async (texts) => texts.map(() => [1, 0, 0, 0]));
const rerankMock = vi.fn(async ({ documents, topN }) => documents.slice(0, topN));

vi.mock('../src/services/embedding.service.js', () => ({ embedTexts: embedTextsMock }));
vi.mock('../src/services/reranker.service.js', () => ({ rerank: rerankMock }));

const { default: app } = await import('../src/app.js');

let counter = 0;
async function signupAndLogin() {
  counter += 1;
  const email = `cache-user${counter}@example.com`;
  const password = 'password123';
  const tenantName = `Cache Tenant ${counter}`;

  await request(app).post('/api/auth/signup').send({ email, password, tenantName });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body;
}

async function uploadText(token, filename, content) {
  const res = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from(content), { filename, contentType: 'text/plain' });
  expect(res.status).toBe(201);
  return res.body.document;
}

describe('semantic cache in front of /api/query/search', () => {
  beforeEach(() => {
    rerankMock.mockClear();
  });

  it('a semantically similar but textually different query hits the cache instead of re-running retrieval', async () => {
    const { token } = await signupAndLogin();
    await uploadText(token, 'refund.txt', 'Our refund policy allows returns within 30 days.');

    const first = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What is the refund policy?' });
    expect(first.status).toBe(200);
    expect(rerankMock).toHaveBeenCalledTimes(1);

    const second = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'Tell me about refunds please' }); // different string, same (mocked) embedding

    expect(second.status).toBe(200);
    expect(rerankMock).toHaveBeenCalledTimes(1); // still 1 — served from cache, retrieval did not re-run
    expect(second.body.results).toEqual(first.body.results);
  });

  it('never serves tenant A\'s cached results to tenant B, even for the identical query', async () => {
    const tenantA = await signupAndLogin();
    const tenantB = await signupAndLogin();
    await uploadText(tenantA.token, 'refund.txt', 'Our refund policy allows returns within 30 days.');

    await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ query: 'refund policy' });

    const res = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ query: 'refund policy' });

    expect(res.body.results).toEqual([]); // tenant B has no documents of its own
  });
});
