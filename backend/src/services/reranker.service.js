import { config } from '../config/index.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

/**
 * Cohere Rerank (rerank-english-v3.0) is used as the cross-encoder reranking
 * step. Why Cohere specifically: it's a purpose-built cross-encoder served
 * as a single hosted endpoint — no model to host or GPU to provision, which
 * matters for a solo project — and it's noticeably more accurate for pure
 * "how relevant is this passage to this query" scoring than asking a
 * general-purpose LLM to do the same job (LLM-as-reranker), at a fraction of
 * the latency/cost per call. ARCHITECTURE.md calls a "simpler first pass"
 * acceptable here; a dedicated cross-encoder API is that simplest correct
 * option without standing up local inference infrastructure.
 *
 * Takes the RRF-merged candidates and returns the top N re-ordered by the
 * cross-encoder's relevance score — this is the last correction step before
 * anything reaches the LLM.
 */
export async function rerank({ query, documents, topN }) {
  if (documents.length === 0) return [];

  if (!config.reranker.apiKey) {
    const err = new Error('RERANKER_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const response = await fetchWithRetry(config.reranker.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.reranker.apiKey}`,
    },
    body: JSON.stringify({
      model: config.reranker.model,
      query,
      documents: documents.map((doc) => doc.text),
      top_n: topN,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Rerank request failed (${response.status}): ${body}`);
    err.status = 502; // this server's own response code — we failed to reach a dependency
    err.upstreamStatus = response.status; // the dependency's actual code (e.g. 429), for callers that need to distinguish retryable failures
    throw err;
  }

  const data = await response.json();
  // Cohere returns { results: [{ index, relevance_score }, ...] }, already
  // sorted by relevance_score descending.
  return data.results.map((result) => ({
    ...documents[result.index],
    rerankScore: result.relevance_score,
  }));
}
