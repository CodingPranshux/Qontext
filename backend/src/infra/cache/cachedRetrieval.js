import { config } from '../../config/index.js';
import { embedTexts as realEmbedTexts } from '../../services/embedding.service.js';
import { rerank as realRerank } from '../../services/reranker.service.js';
import { search as realSearch } from '../../services/retrieval.service.js';
import semanticCache from './semanticCache.js';
import { logStage } from '../logging/logger.js';
import { timeAsync } from '../logging/timing.js';
import { estimateEmbeddingCost, estimateRerankCost } from '../logging/costEstimator.js';

/**
 * Phase 5 composition layer: adds a semantic cache check and per-stage
 * latency/cost logging in front of Phase 3's retrieval.service.js, WITHOUT
 * modifying that file. It does this entirely through the dependency-
 * injection seams Phase 3 already exposes for testability (`embedTexts`,
 * `rerank` as overridable parameters of `search()`) — Phase 5 just supplies
 * cached/instrumented implementations of those seams from the outside.
 *
 * Controllers call this instead of retrieval.service.js's `search` directly.
 * Same return shape ({ results }) so it's a drop-in replacement anywhere
 * `search` is used, including as generation.service.js's injectable
 * `search` dependency.
 */
export async function runRetrieval({ tenantId, query }) {
  const tenantKey = tenantId.toString();

  const {
    result: [queryEmbedding],
    durationMs: embedMs,
  } = await timeAsync(() => realEmbedTexts([query]));
  logStage('embed', { durationMs: embedMs, costUsd: estimateEmbeddingCost([query]) });

  const cached = await semanticCache.get({
    tenantId: tenantKey,
    embedding: queryEmbedding,
    threshold: config.cache.similarityThreshold,
  });

  if (cached) {
    logStage('cache', { hit: true, similarity: cached.score });
    return { results: cached.results };
  }
  logStage('cache', { hit: false });

  // Reuse the embedding computed above instead of having search() embed the
  // same query a second time — it already accepts embedTexts as a seam.
  const reuseQueryEmbedding = async () => [queryEmbedding];

  let rerankMs = 0;
  const loggedRerank = async (args) => {
    const { result, durationMs } = await timeAsync(() => realRerank(args));
    rerankMs += durationMs;
    logStage('rerank', { durationMs, costUsd: estimateRerankCost(args.documents?.length ?? 0) });
    return result;
  };

  const { result: searchOutput, durationMs: searchTotalMs } = await timeAsync(() =>
    realSearch({ tenantId, query, embedTexts: reuseQueryEmbedding, rerank: loggedRerank })
  );

  // "retrieve" = vector search + BM25 + RRF merge, i.e. everything inside
  // search() except the rerank call already measured/logged separately above.
  logStage('retrieve', { durationMs: Math.max(searchTotalMs - rerankMs, 0) });

  await semanticCache.set({
    tenantId: tenantKey,
    query,
    embedding: queryEmbedding,
    results: searchOutput.results,
    ttlSeconds: config.cache.ttlSeconds,
  });

  return { results: searchOutput.results };
}
