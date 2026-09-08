import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// The query endpoint's own retrieval/embedding calls aren't the point of
// this test — mock them so requests are fast and don't need API keys.
vi.mock('../src/services/embedding.service.js', () => ({
  embedTexts: vi.fn(async (texts) => texts.map(() => [1, 0, 0, 0])),
}));
vi.mock('../src/services/reranker.service.js', () => ({
  rerank: vi.fn(async ({ documents, topN }) => documents.slice(0, topN)),
}));

const { default: app } = await import('../src/app.js');

let counter = 0;
async function signupAndLogin() {
  counter += 1;
  const email = `ratelimit-user${counter}@example.com`;
  const password = 'password123';
  const tenantName = `Rate Limit Tenant ${counter}`;

  await request(app).post('/api/auth/signup').send({ email, password, tenantName });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body;
}

describe('per-tenant rate limiting on /api/query/search', () => {
  it('allows requests up to the configured limit, then 429s with a Retry-After header', async () => {
    const { token } = await signupAndLogin();

    // Test env sets RATE_LIMIT_MAX_REQUESTS=5 (see tests/setup.js).
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/query/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: `question ${i}` });
      expect(res.status).toBe(200);
    }

    const limited = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'one too many' });

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeTruthy();
  });

  it('does not let one tenant exhausting its bucket affect another tenant', async () => {
    const tenantA = await signupAndLogin();
    const tenantB = await signupAndLogin();

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/query/search')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ query: `question ${i}` });
    }
    const exhausted = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ query: 'blocked' });
    expect(exhausted.status).toBe(429);

    const stillAllowed = await request(app)
      .post('/api/query/search')
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ query: 'not blocked' });
    expect(stillAllowed.status).toBe(200);
  });
});
