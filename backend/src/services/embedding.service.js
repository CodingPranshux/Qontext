import { countTokens } from 'gpt-tokenizer';
import { config } from '../config/index.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';
import { AsyncTokenBucket } from '../utils/rateLimiter.js';

const EMBEDDING_CONCURRENCY = 5;

// Gemini's free tier for gemini-embedding-001 is 100 req/min and 30,000
// tokens/min (confirmed from the account's own rate-limit dashboard — a
// bulk document upload was measuring 29.96K/30K TPM right before a burst of
// 429s). Concurrency alone doesn't bound *throughput* — 5 fast workers can
// still push well past 30K tokens/min on a large document. These buckets
// pace actual request/token dispatch to stay under the limit, at 80%
// headroom so gpt-tokenizer's count (an estimate — Gemini's own tokenizer
// may differ slightly) and any concurrent chat traffic still fit safely.
const requestBucket = new AsyncTokenBucket({ capacity: 80, refillPerSecond: 80 / 60 });
const tokenBucket = new AsyncTokenBucket({ capacity: 24_000, refillPerSecond: 24_000 / 60 });

/**
 * Runs fn(item) across items with at most `limit` in flight at once, e.g.
 * so a large document's chunks don't all hit the embedding API in one burst
 * and blow through its free-tier rate limit.
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Embeds one text via Google's Gemini embedding API (gemini-embedding-001
 * by default). Uses the single-item embedContent endpoint rather than
 * batchEmbedContents — its per-item request shape is the one Google's docs
 * confirm unambiguously ({ content: { parts: [{ text }] } } in, { embedding:
 * { values: [...] } } out), whereas the batch endpoint's exact per-item
 * shape is less clearly documented. embedTexts() below calls this once per
 * text in parallel instead.
 */
async function embedOne(text) {
  const url = `${config.embedding.apiUrl}/${config.embedding.model}:embedContent`;

  // Wait for both a request slot and enough token budget in the current
  // minute before dispatching — this is what actually keeps us under
  // Gemini's per-minute caps, not just the in-flight concurrency cap below.
  await requestBucket.acquire(1);
  await tokenBucket.acquire(countTokens(text));

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.embedding.apiKey,
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      // Match the vector store's column width (see config.vectorStore.dimensions)
      // rather than Gemini's full 3072-dim default.
      output_dimensionality: config.vectorStore.dimensions,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Embedding request failed (${response.status}): ${body}`);
    err.status = 502; // this server's own response code — we failed to reach a dependency
    err.upstreamStatus = response.status; // the dependency's actual code (e.g. 429), for callers that need to distinguish retryable failures
    throw err;
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Embeds a batch of texts, in the same order as the input. Dispatch is
 * throttled by the module-level request/token buckets above (shared with
 * every other embedTexts() caller, e.g. a chat question's query embedding,
 * since Gemini's rate limit is per-account, not per-call); EMBEDDING_CONCURRENCY
 * just bounds how many chunks are queued waiting on those buckets at once.
 */
export async function embedTexts(texts) {
  if (!config.embedding.apiKey) {
    const err = new Error('EMBEDDING_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  return mapWithConcurrency(texts, EMBEDDING_CONCURRENCY, embedOne);
}
