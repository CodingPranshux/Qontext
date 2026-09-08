import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { config } from '../../config/index.js';

let client;
function getClient() {
  if (!client) {
    client = new Redis(config.redis.url);
  }
  return client;
}

const KEY_PREFIX = 'semcache';
const MAX_ENTRIES_PER_TENANT = 200;

const valueKey = (tenantId, entryId) => `${KEY_PREFIX}:${tenantId}:entry:${entryId}`;
const indexKey = (tenantId) => `${KEY_PREFIX}:${tenantId}:index`;

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

/**
 * Scans this tenant's recent cache entries and returns the one whose query
 * embedding is most similar to the current query, if any clears the
 * threshold — this is what makes it a *semantic* cache: a paraphrased query
 * with a different exact string can still hit.
 */
async function get({ tenantId, embedding, threshold }) {
  const redis = getClient();
  const entryIds = await redis.lrange(indexKey(tenantId), 0, MAX_ENTRIES_PER_TENANT - 1);
  if (entryIds.length === 0) return null;

  const raws = await redis.mget(entryIds.map((id) => valueKey(tenantId, id)));

  let best = null;
  for (const raw of raws) {
    if (!raw) continue; // expired (TTL'd out) or evicted
    const entry = JSON.parse(raw);
    const score = cosineSimilarity(embedding, entry.embedding);
    if (score >= threshold && (!best || score > best.score)) {
      best = { query: entry.query, results: entry.results, score };
    }
  }

  return best;
}

async function set({ tenantId, query, embedding, results, ttlSeconds }) {
  const redis = getClient();
  const entryId = randomUUID();

  await redis.set(valueKey(tenantId, entryId), JSON.stringify({ query, embedding, results }), 'EX', ttlSeconds);
  await redis.lpush(indexKey(tenantId), entryId);
  await redis.ltrim(indexKey(tenantId), 0, MAX_ENTRIES_PER_TENANT - 1);
  await redis.expire(indexKey(tenantId), ttlSeconds * 2);
}

async function clearAll() {
  const redis = getClient();
  const keys = await redis.keys(`${KEY_PREFIX}:*`);
  if (keys.length > 0) await redis.del(...keys);
}

export default { get, set, clearAll };
