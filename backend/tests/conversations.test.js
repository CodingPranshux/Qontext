import { describe, it, expect } from 'vitest';
import request from 'supertest';

const { default: app } = await import('../src/app.js');

let counter = 0;
async function signupAndLogin() {
  counter += 1;
  const email = `convo-user${counter}@example.com`;
  const password = 'password123';
  const tenantName = `Convo Tenant ${counter}`;

  await request(app).post('/api/auth/signup').send({ email, password, tenantName });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body; // { token, user: { id, email, tenantId } }
}

function sampleTurn(overrides = {}) {
  return {
    question: 'What is the refund window?',
    answer: 'Refunds are allowed within 30 days [chunk_id: abc123].',
    sources: [
      {
        chunkId: 'abc123',
        text: 'Refunds are allowed within 30 days of purchase.',
        documentId: 'doc1',
        sourceFilename: 'policy.txt',
        chunkIndex: 0,
        startOffset: 0,
        endOffset: 40,
        rerankScore: 0.87,
      },
    ],
    citedChunkIds: ['abc123'],
    retrievalQuery: null,
    rewritten: false,
    latencyMs: 120,
    status: 'done',
    error: null,
    askedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('GET /api/conversations/active', () => {
  it('returns an empty turns array when nothing has been saved yet', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).get('/api/conversations/active').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.turns).toEqual([]);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/conversations/active');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/conversations/active/turns', () => {
  it('appends a turn and it shows up in the active conversation, in order', async () => {
    const { token } = await signupAndLogin();

    const postRes = await request(app)
      .post('/api/conversations/active/turns')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleTurn());
    expect(postRes.status).toBe(201);
    expect(postRes.body.turn.question).toBe('What is the refund window?');
    expect(postRes.body.turn.id).toBeTruthy();

    await request(app)
      .post('/api/conversations/active/turns')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleTurn({ question: 'And what about exchanges?' }));

    const getRes = await request(app).get('/api/conversations/active').set('Authorization', `Bearer ${token}`);
    expect(getRes.body.turns).toHaveLength(2);
    expect(getRes.body.turns[0].question).toBe('What is the refund window?');
    expect(getRes.body.turns[1].question).toBe('And what about exchanges?');
    expect(getRes.body.turns[0].sources[0].chunkId).toBe('abc123');
    expect(getRes.body.turns[0].citedChunkIds).toEqual(['abc123']);
  });

  it('stores an error turn as-is, distinguishable from a done turn', async () => {
    const { token } = await signupAndLogin();

    await request(app)
      .post('/api/conversations/active/turns')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleTurn({ status: 'error', error: 'LLM request failed (429): rate limited', answer: '' }));

    const getRes = await request(app).get('/api/conversations/active').set('Authorization', `Bearer ${token}`);
    expect(getRes.body.turns[0].status).toBe('error');
    expect(getRes.body.turns[0].error).toBe('LLM request failed (429): rate limited');
  });

  it('rejects a turn with no question', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app)
      .post('/api/conversations/active/turns')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleTurn({ question: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/conversations/active/turns').send(sampleTurn());
    expect(res.status).toBe(401);
  });

  it('rejects an attempt to override tenantId via the request body', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app)
      .post('/api/conversations/active/turns')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...sampleTurn(), tenantId: '000000000000000000000000' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/conversations/active', () => {
  it('clears a saved conversation', async () => {
    const { token } = await signupAndLogin();

    await request(app).post('/api/conversations/active/turns').set('Authorization', `Bearer ${token}`).send(sampleTurn());

    const deleteRes = await request(app).delete('/api/conversations/active').set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get('/api/conversations/active').set('Authorization', `Bearer ${token}`);
    expect(getRes.body.turns).toEqual([]);
  });

  it('is a no-op when there is nothing to clear', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).delete('/api/conversations/active').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

describe('tenant isolation', () => {
  it('never lists or lets a user append to another tenant\'s conversation', async () => {
    const tenantA = await signupAndLogin();
    const tenantB = await signupAndLogin();

    await request(app)
      .post('/api/conversations/active/turns')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send(sampleTurn({ question: "Tenant A's question" }));

    const res = await request(app).get('/api/conversations/active').set('Authorization', `Bearer ${tenantB.token}`);
    expect(res.body.turns).toEqual([]);
  });

  it('gives each user in the same tenant their own conversation', async () => {
    const { user, token: tokenA } = await signupAndLogin();
    // Second user manually created in the same tenant, rather than via signup
    // (which always creates a new tenant) — mirrors how a real multi-user
    // tenant would look.
    const { User } = await import('../src/models/User.js');
    const bcrypt = (await import('bcryptjs')).default;
    const passwordHash = await bcrypt.hash('password123', 10);
    const userB = await User.create({ email: `teammate${counter}@example.com`, passwordHash, tenantId: user.tenantId });
    const { signToken } = await import('../src/services/auth.service.js');
    const tokenB = signToken({ userId: userB._id.toString(), tenantId: user.tenantId });

    await request(app)
      .post('/api/conversations/active/turns')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(sampleTurn({ question: "A's question" }));

    const resB = await request(app).get('/api/conversations/active').set('Authorization', `Bearer ${tokenB}`);
    expect(resB.body.turns).toEqual([]);
  });
});
