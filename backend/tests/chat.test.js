import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Chat generation calls out to OpenAI (query embedding + chat completion) and
// Cohere (reranking). Mock all three network-calling leaf modules so the
// suite is deterministic with no API keys, while retrieval, prompt-building,
// and citation validation all run for real.
const { streamChatCompletionMock, embedTextsMock, rewriteQueryMock } = vi.hoisted(() => {
  // Fake "LLM": if the prompt contains a chunk_id, cite it (proving a real
  // chunk_id flows prompt -> model -> citation); otherwise behave like a
  // general-purpose chatbot answering from its own "knowledge", with no
  // citation — mirroring the real system prompt's hybrid behavior.
  const streamChatCompletionMock = vi.fn(async ({ userPrompt, onToken }) => {
    const match = userPrompt.match(/\[chunk_id:\s*([^\]]+)\]/);
    let answer;
    if (match) {
      answer = `Based on the documents, refunds are allowed within 30 days [chunk_id: ${match[1]}].`;
    } else if (/2\s*\+\s*2/.test(userPrompt)) {
      answer = '2 + 2 is 4.';
    } else {
      answer = "I'm just a friendly assistant, happy to help!";
    }
    onToken?.(answer);
    return answer;
  });

  const embedTextsMock = vi.fn(async (texts) => texts.map(() => [1, 0, 0, 0]));

  // Fake query rewriter: deterministic, distinguishable output so tests can
  // prove the REWRITTEN query (not the raw one) is what reaches retrieval.
  const rewriteQueryMock = vi.fn(async ({ query }) => `REWRITTEN(${query})`);

  return { streamChatCompletionMock, embedTextsMock, rewriteQueryMock };
});

vi.mock('../src/services/embedding.service.js', () => ({ embedTexts: embedTextsMock }));
vi.mock('../src/services/reranker.service.js', () => ({
  rerank: vi.fn(async ({ documents, topN }) => documents.slice(0, topN)),
}));
vi.mock('../src/services/llmClient.service.js', () => ({ streamChatCompletion: streamChatCompletionMock }));
vi.mock('../src/services/queryRewriter.service.js', () => ({ rewriteQuery: rewriteQueryMock }));

const { default: app } = await import('../src/app.js');
const { Chunk } = await import('../src/models/Chunk.js');

let counter = 0;
async function signupAndLogin() {
  counter += 1;
  const email = `chat-user${counter}@example.com`;
  const password = 'password123';
  const tenantName = `Chat Tenant ${counter}`;

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

function parseSse(raw) {
  return raw
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const lines = block.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event:'));
      const dataLine = lines.find((l) => l.startsWith('data:'));
      return {
        event: eventLine ? eventLine.slice('event:'.length).trim() : null,
        data: dataLine ? JSON.parse(dataLine.slice('data:'.length).trim()) : null,
      };
    });
}

describe('POST /api/chat/ask', () => {
  beforeEach(() => {
    rewriteQueryMock.mockClear();
    embedTextsMock.mockClear();
  });

  it('rejects an ask attempting to override tenantId via the request body', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'anything', tenantId: '000000000000000000000000' });
    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated ask', async () => {
    const res = await request(app).post('/api/chat/ask').send({ query: 'anything' });
    expect(res.status).toBe(401);
  });

  it('rejects an ask with no query', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).post('/api/chat/ask').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it('streams a sources event, token event(s), and a done event with at least one valid citation from this tenant\'s own data', async () => {
    const { token, user } = await signupAndLogin();
    await uploadText(token, 'refund-policy.txt', 'Our refund policy allows returns within 30 days.');

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What is the refund policy?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);

    const events = parseSse(res.text);

    const sourcesEvent = events.find((e) => e.event === 'sources');
    expect(sourcesEvent).toBeTruthy();
    const sourceChunkIds = sourcesEvent.data.sources.map((s) => s.chunkId);
    expect(sourceChunkIds.length).toBeGreaterThan(0);

    const tokenEvents = events.filter((e) => e.event === 'token');
    expect(tokenEvents.length).toBeGreaterThan(0);
    expect(tokenEvents.map((e) => e.data.content).join('')).toContain('[chunk_id:');

    const doneEvent = events.find((e) => e.event === 'done');
    expect(doneEvent).toBeTruthy();
    expect(doneEvent.data.citedChunkIds.length).toBeGreaterThan(0);

    // Every cited chunk_id must be one of the sources actually shown to the model...
    for (const citedId of doneEvent.data.citedChunkIds) {
      expect(sourceChunkIds).toContain(citedId);
    }

    // ...and must be a real chunk that actually belongs to this tenant, not a
    // fabricated id — the whole point of Phase 4's citation requirement.
    const citedChunk = await Chunk.findOne({ _id: doneEvent.data.citedChunkIds[0], tenantId: user.tenantId });
    expect(citedChunk).not.toBeNull();
  });

  it('never answers from another tenant\'s data', async () => {
    const tenantA = await signupAndLogin();
    const tenantB = await signupAndLogin();
    await uploadText(tenantA.token, 'refund-policy.txt', 'Our refund policy allows returns within 30 days.');

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ query: 'What is the refund policy?' });

    expect(res.status).toBe(200);
    const events = parseSse(res.text);

    const sourcesEvent = events.find((e) => e.event === 'sources');
    expect(sourcesEvent.data.sources).toEqual([]);

    const doneEvent = events.find((e) => e.event === 'done');
    expect(doneEvent.data.citedChunkIds).toEqual([]);
  });

  it('answers a general-knowledge question even with no documents, instead of refusing', async () => {
    const { token } = await signupAndLogin(); // fresh tenant, zero documents

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What is 2+2?' });

    expect(res.status).toBe(200);
    const events = parseSse(res.text);

    const answerText = events
      .filter((e) => e.event === 'token')
      .map((e) => e.data.content)
      .join('');

    expect(answerText).toContain('4');
    expect(answerText).not.toContain('[chunk_id:');
    expect(answerText).not.toMatch(/don't have any documents/i);

    const doneEvent = events.find((e) => e.event === 'done');
    expect(doneEvent.data.citedChunkIds).toEqual([]); // nothing to cite — it wasn't sourced from documents
  });

  it('forwards sanitized conversation history to the LLM for follow-up questions', async () => {
    const { token } = await signupAndLogin();

    const history = [
      { role: 'user', content: 'What is the refund policy?' },
      { role: 'assistant', content: 'Refunds are allowed within 30 days.' },
      { role: 'not-a-real-role', content: 'should be dropped' },
      { role: 'user', content: 42 }, // non-string content — should be dropped
    ];

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What about shipping?', history });

    expect(res.status).toBe(200);

    const call = streamChatCompletionMock.mock.calls.at(-1)[0];
    expect(call.history).toEqual([
      { role: 'user', content: 'What is the refund policy?' },
      { role: 'assistant', content: 'Refunds are allowed within 30 days.' },
    ]);
  });

  it('ignores a non-array history value rather than erroring', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'hello', history: 'not-an-array' });

    expect(res.status).toBe(200);
    const call = streamChatCompletionMock.mock.calls.at(-1)[0];
    expect(call.history).toEqual([]);
  });

  it('skips query rewriting for a conversation\'s first message (nothing to resolve against)', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What is the refund policy?' });

    expect(res.status).toBe(200);
    expect(rewriteQueryMock).not.toHaveBeenCalled();
    // Retrieval embeds the raw query unchanged, not a rewritten one.
    expect(embedTextsMock).toHaveBeenCalledWith(['What is the refund policy?']);
  });

  it('rewrites a follow-up into a standalone question before retrieval', async () => {
    const { token } = await signupAndLogin();
    const history = [
      { role: 'user', content: 'What is the refund policy?' },
      { role: 'assistant', content: 'Refunds are allowed within 30 days.' },
    ];

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What about shipping?', history });

    expect(res.status).toBe(200);
    expect(rewriteQueryMock).toHaveBeenCalledWith({ query: 'What about shipping?', history });
    // The REWRITTEN query is what gets embedded for retrieval, not the raw one.
    expect(embedTextsMock).toHaveBeenCalledWith(['REWRITTEN(What about shipping?)']);
  });

  it('emits a retrieval event with the unmodified query when nothing was rewritten', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What is the refund policy?' });

    expect(res.status).toBe(200);
    const events = parseSse(res.text);
    const retrievalEvent = events.find((e) => e.event === 'retrieval');
    expect(retrievalEvent).toBeTruthy();
    expect(retrievalEvent.data).toEqual({ query: 'What is the refund policy?', rewritten: false });

    // The retrieval event must arrive before sources/tokens, so the client can
    // show a "searching" state for the actual duration of retrieval.
    expect(events.indexOf(retrievalEvent)).toBeLessThan(events.findIndex((e) => e.event === 'sources'));
  });

  it('emits a retrieval event with the rewritten query and rewritten:true for a follow-up', async () => {
    const { token } = await signupAndLogin();
    const history = [
      { role: 'user', content: 'What is the refund policy?' },
      { role: 'assistant', content: 'Refunds are allowed within 30 days.' },
    ];

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What about shipping?', history });

    expect(res.status).toBe(200);
    const events = parseSse(res.text);
    const retrievalEvent = events.find((e) => e.event === 'retrieval');
    expect(retrievalEvent.data).toEqual({ query: 'REWRITTEN(What about shipping?)', rewritten: true });
  });

  it('falls back to the raw query (via the cheap heuristic) if rewriting fails, without breaking the request', async () => {
    const { token } = await signupAndLogin();
    const history = [
      { role: 'user', content: 'What is the refund policy?' },
      { role: 'assistant', content: 'Refunds are allowed within 30 days.' },
    ];

    rewriteQueryMock.mockRejectedValueOnce(new Error('rewrite provider down'));

    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What about shipping?', history });

    expect(res.status).toBe(200);
    // Fallback heuristic: previous user turn + current query.
    expect(embedTextsMock).toHaveBeenCalledWith(['What is the refund policy?\nWhat about shipping?']);
  });
});
