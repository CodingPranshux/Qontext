import { config } from '../config/index.js';
import { Chunk } from '../models/Chunk.js';
import vectorStore from '../models/vectorStore/index.js';
import { embedTexts as defaultEmbedTexts } from './embedding.service.js';
import { computeBM25Scores } from './bm25.service.js';
import { reciprocalRankFusion } from './rrf.service.js';
import { rerank as defaultRerank } from './reranker.service.js';

/**
 * BM25 leg of hybrid search: scores this tenant's chunks against the query.
 * Re-filters by tenantId itself even though every caller already scopes to
 * one tenant — every DB query in this codebase filters by tenant_id, no
 * exceptions (ARCHITECTURE.md non-negotiable), including this internal one.
 */
async function keywordSearch({ tenantId, query, topK }) {
  const chunks = await Chunk.find({ tenantId }).select('_id text').lean();
  if (chunks.length === 0) return [];

  const scores = computeBM25Scores(
    query,
    chunks.map((chunk) => ({ id: chunk._id.toString(), text: chunk.text }))
  );

  return scores.slice(0, topK).map((s) => ({ chunkId: s.id, score: s.score }));
}

/**
 * Full Layer 3 pipeline: embed query -> vector search + BM25 in parallel ->
 * RRF merge -> cross-encoder rerank -> final top-N. tenantId must already be
 * a trusted value derived from the JWT (requireAuth) — every stage below
 * filters by it.
 */
export async function search({
  tenantId,
  query,
  embedTexts = defaultEmbedTexts,
  rerank = defaultRerank,
  vectorTopK = config.retrieval.vectorTopK,
  bm25TopK = config.retrieval.bm25TopK,
  rrfK = config.retrieval.rrfK,
  rerankTopN = config.retrieval.rerankTopN,
}) {
  if (!tenantId) {
    throw new Error('search requires a tenantId derived from the authenticated request');
  }
  if (!query || !query.trim()) {
    const err = new Error('query is required');
    err.status = 400;
    throw err;
  }

  const [queryEmbedding] = await embedTexts([query]);

  const [vectorResults, bm25Results] = await Promise.all([
    vectorStore.queryTopK({ tenantId: tenantId.toString(), embedding: queryEmbedding, topK: vectorTopK }),
    keywordSearch({ tenantId, query, topK: bm25TopK }),
  ]);

  const fused = reciprocalRankFusion(
    [vectorResults.map((r) => r.chunkId), bm25Results.map((r) => r.chunkId)],
    { k: rrfK }
  );

  const mergedTopK = fused.slice(0, Math.max(vectorTopK, bm25TopK));
  const chunkIds = mergedTopK.map((f) => f.id);

  // Re-filtering by tenantId here even though every id already came from a
  // tenant-scoped query above — defense in depth, not decoration.
  const chunks = await Chunk.find({ tenantId, _id: { $in: chunkIds } }).lean();
  const chunkById = new Map(chunks.map((chunk) => [chunk._id.toString(), chunk]));

  const candidates = mergedTopK
    .map((f) => chunkById.get(f.id))
    .filter(Boolean)
    .map((chunk) => ({
      chunkId: chunk._id.toString(),
      text: chunk.text,
      documentId: chunk.documentId.toString(),
      sourceFilename: chunk.sourceFilename,
      chunkIndex: chunk.chunkIndex,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
    }));

  if (candidates.length === 0) {
    return { results: [], debug: { vectorResults, bm25Results, fused } };
  }

  // The reranker is a hosted API with its own (often tight, e.g. Cohere free
  // tier's 10 req/min) rate limit — a still-exhausted quota after retries
  // shouldn't take the whole search down. Fall back to the RRF-fused order
  // (already relevance-ordered, just not cross-encoder-scored) instead of
  // throwing, same pattern as the query-rewrite fallback above it.
  let results;
  try {
    results = await rerank({ query, documents: candidates, topN: Math.min(rerankTopN, candidates.length) });
  } catch {
    results = candidates.slice(0, rerankTopN).map((chunk) => ({ ...chunk, rerankScore: null }));
  }

  return { results, debug: { vectorResults, bm25Results, fused } };
}
