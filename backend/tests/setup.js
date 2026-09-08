// Set before anything else so src/config/index.js picks these up on first import.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
// No live Postgres+pgvector in the test environment — use the in-memory
// vector store driver instead (same interface, see src/models/vectorStore).
process.env.VECTOR_STORE_DRIVER = 'memory';
// Same idea for the semantic cache — no live Redis in tests.
process.env.CACHE_DRIVER = 'memory';
// Low capacity so a dedicated rate-limit test can trip it in a handful of
// requests; every other test's tenant sends far fewer than this per test.
process.env.RATE_LIMIT_MAX_REQUESTS = '5';

import { beforeAll, afterEach, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Dynamic import: a static import here would be hoisted and evaluated
// before the process.env assignments above run (ESM module instantiation
// order), so src/config/index.js would read VECTOR_STORE_DRIVER as unset
// and default to the real pgvector driver instead of the in-memory one.
const { default: vectorStore } = await import('../src/models/vectorStore/index.js');
const { default: semanticCache } = await import('../src/infra/cache/semanticCache.js');
const { _resetRateLimitStoreForTests } = await import('../src/middleware/rateLimit.middleware.js');

let mongod;

// mongodb-memory-server picks a random ephemeral port per instance. On
// Windows with Docker Desktop's WSL2/Hyper-V backend running, Windows can
// dynamically reserve chunks of the ephemeral port range, occasionally
// causing an EACCES on whatever port got picked — nothing to do with this
// codebase, just OS/Docker port-reservation roulette. Retrying with a fresh
// random port resolves it.
async function createMongoMemoryServerWithRetry(attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await MongoMemoryServer.create();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

beforeAll(async () => {
  mongod = await createMongoMemoryServerWithRetry();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  await vectorStore.clearAll();
  await semanticCache.clearAll();
  _resetRateLimitStoreForTests();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});
