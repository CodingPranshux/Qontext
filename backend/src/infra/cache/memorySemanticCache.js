// In-memory stand-in for the Redis-backed semantic cache, used only by the
// test suite so it doesn't need a live Redis (mirrors memoryVectorStore.js
// for the vector store). Same interface as redisSemanticCache.js.

const store = new Map(); // tenantId -> Array<{ query, embedding, results, expiresAt }>

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function get({ tenantId, embedding, threshold }) {
  const entries = store.get(tenantId) || [];
  const now = Date.now();

  let best = null;
  for (const entry of entries) {
    if (entry.expiresAt < now) continue;
    const score = cosineSimilarity(embedding, entry.embedding);
    if (score >= threshold && (!best || score > best.score)) {
      best = { query: entry.query, results: entry.results, score };
    }
  }

  return best;
}

async function set({ tenantId, query, embedding, results, ttlSeconds = 3600 }) {
  const entries = store.get(tenantId) || [];
  entries.push({ query, embedding, results, expiresAt: Date.now() + ttlSeconds * 1000 });
  store.set(tenantId, entries);
}

async function clearAll() {
  store.clear();
}

export default { get, set, clearAll };
