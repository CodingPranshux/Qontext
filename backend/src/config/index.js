import 'dotenv/config';

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  // pgvector-backed vector store
  postgres: {
    url: process.env.POSTGRES_URL,
    vectorTable: process.env.PGVECTOR_TABLE || 'embeddings',
    // Managed Postgres (Neon, Supabase, ...) requires SSL; local Docker doesn't.
    // Auto-detected from the connection string, or force with POSTGRES_SSL=true/false.
    ssl: process.env.POSTGRES_SSL
      ? process.env.POSTGRES_SSL === 'true'
      : /sslmode=require|neon\.tech|supabase\.co|render\.com/.test(process.env.POSTGRES_URL || ''),
  },

  vectorStore: {
    // 'pgvector' in real use; tests force 'memory' (see tests/setup.js) so the
    // suite doesn't need a live Postgres+pgvector instance.
    driver: process.env.VECTOR_STORE_DRIVER || 'pgvector',
    dimensions: Number(process.env.EMBEDDING_DIMENSIONS) || 1536,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  // Semantic cache (Phase 5, see src/infra/cache/) — cache hit/miss is based
  // on embedding similarity to a *past* query, not exact string match.
  cache: {
    // 'redis' in real use; tests force 'memory' (see tests/setup.js), same
    // pattern as vectorStore.driver.
    driver: process.env.CACHE_DRIVER || 'redis',
    similarityThreshold: Number(process.env.SEMANTIC_CACHE_SIMILARITY_THRESHOLD) || 0.92,
    ttlSeconds: Number(process.env.SEMANTIC_CACHE_TTL_SECONDS) || 3600,
  },

  // Gemini embeddings (Google AI Studio) — free tier, no card required.
  // Switched from OpenAI so the whole stack runs at $0.
  embedding: {
    apiKey: process.env.EMBEDDING_API_KEY,
    apiUrl: process.env.EMBEDDING_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
    model: process.env.EMBEDDING_MODEL || 'gemini-embedding-001',
  },

  // Cohere Rerank — hosted cross-encoder, see reranker.service.js for why.
  // Free trial tier: 1,000 calls/month, 10 req/min, no card required.
  reranker: {
    apiKey: process.env.RERANKER_API_KEY,
    apiUrl: process.env.RERANKER_API_URL || 'https://api.cohere.com/v2/rerank',
    model: process.env.RERANKER_MODEL || 'rerank-english-v3.0',
  },

  // Groq chat completions — OpenAI-compatible API, free tier, no card
  // required. Switched from OpenAI so the whole stack runs at $0.
  llm: {
    apiKey: process.env.LLM_API_KEY,
    apiUrl: process.env.LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
    model: process.env.LLM_MODEL || 'openai/gpt-oss-120b',
  },

  chunking: {
    size: Number(process.env.CHUNK_SIZE) || 500,
    overlap: Number(process.env.CHUNK_OVERLAP) || 50,
  },

  upload: {
    maxFileSizeBytes: (Number(process.env.MAX_UPLOAD_FILE_SIZE_MB) || 10) * 1024 * 1024,
  },

  retrieval: {
    vectorTopK: Number(process.env.RETRIEVAL_VECTOR_TOP_K) || 20,
    bm25TopK: Number(process.env.RETRIEVAL_BM25_TOP_K) || 20,
    rrfK: Number(process.env.RETRIEVAL_RRF_K) || 60,
    rerankTopN: Number(process.env.RETRIEVAL_RERANK_TOP_N) || 5,
  },

  // Per-tenant token bucket (Phase 5, see src/infra/rateLimit/): capacity is
  // the burst size; refill happens continuously so the bucket is back to
  // capacity after `windowMs` of no requests.
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  logLevel: process.env.LOG_LEVEL || 'info',
  // Optional: append structured JSON log lines to this file in addition to
  // console output. Leave unset to log to console only.
  logFile: process.env.LOG_FILE || null,
};
