const DEFAULT_K = 60;

/**
 * Reciprocal Rank Fusion: merges several ranked lists of the same kind of
 * item into one ranked list, using only each item's *rank* in each list —
 * not the underlying scores, which aren't comparable across a vector search
 * (cosine similarity) and a keyword search (BM25 score).
 *
 *   RRF_score(d) = sum over each list L that contains d of 1 / (k + rank_L(d))
 *
 * rank_L(d) is d's 1-based position in list L. A document missing from a
 * list simply contributes 0 from that list — it doesn't need to appear in
 * every list to be included in the fused result (this is a union, not an
 * intersection).
 *
 * k (default 60, the constant used in the original RRF paper) dampens the
 * effect of any single list: without it, rank 1 (score 1/1) would completely
 * dominate rank 2 (1/2). With k=60, rank 1 (1/61) and rank 2 (1/62) are
 * close together, so a document has to consistently rank well across lists
 * to win, rather than being an outlier top hit in just one of them.
 *
 * @param {Array<Array<string>>} rankedLists - each a list of item ids, best-ranked first
 * @param {{ k?: number }} [options]
 * @returns {Array<{ id: string, score: number }>} fused results, best-ranked first
 */
export function reciprocalRankFusion(rankedLists, { k = DEFAULT_K } = {}) {
  const scores = new Map();

  for (const list of rankedLists) {
    list.forEach((id, i) => {
      const rank = i + 1;
      const contribution = 1 / (k + rank);
      scores.set(id, (scores.get(id) || 0) + contribution);
    });
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
