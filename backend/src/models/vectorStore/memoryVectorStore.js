// In-memory stand-in for the pgvector store, used only by the test suite so
// it doesn't need a live Postgres+pgvector instance (mirrors what
// mongodb-memory-server does for MongoDB). Same interface as pgVectorStore.

const store = new Map(); // chunkId -> { tenantId, embedding }

async function init() {}

async function upsertVector({ tenantId, chunkId, embedding }) {
  store.set(chunkId, { tenantId, embedding });
}

async function findByTenant(tenantId) {
  return Array.from(store.entries())
    .filter(([, value]) => value.tenantId === tenantId)
    .map(([chunkId, value]) => ({ chunkId, tenantId: value.tenantId }));
}

async function clearAll() {
  store.clear();
}

async function deleteByChunkIds(chunkIds) {
  for (const chunkId of chunkIds) store.delete(chunkId);
}

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

async function queryTopK({ tenantId, embedding, topK }) {
  return Array.from(store.entries())
    .filter(([, value]) => value.tenantId === tenantId)
    .map(([chunkId, value]) => ({ chunkId, score: cosineSimilarity(embedding, value.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export default { init, upsertVector, findByTenant, clearAll, queryTopK, deleteByChunkIds };
