const DEFAULT_K1 = 1.5;
const DEFAULT_B = 0.75;

function tokenize(text) {
  return (text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

/**
 * Scores a set of documents against a query using the Okapi BM25 formula:
 *
 *   score(D, Q) = sum over term t in Q of
 *     IDF(t) * ( f(t, D) * (k1 + 1) ) / ( f(t, D) + k1 * (1 - b + b * |D| / avgDocLen) )
 *
 *   IDF(t) = ln( 1 + (N - df(t) + 0.5) / (df(t) + 0.5) )
 *
 * where f(t, D) is how many times term t appears in document D, |D| is D's
 * token count, N is the total document count, and df(t) is how many
 * documents contain t at least once. Terms that appear in fewer documents
 * (higher IDF) count for more; a term repeated many times in one document
 * gives diminishing returns (the k1 saturation term); longer documents are
 * penalized relative to the corpus average so length alone doesn't win (the
 * b length-normalization term).
 *
 * This is implemented in-process (no Elasticsearch/Atlas Search) — the
 * caller is expected to have already narrowed `documents` to one tenant, so
 * this function itself has no notion of tenant_id. At real scale you'd want
 * a persistent inverted index (e.g. MongoDB Atlas Search) instead of
 * re-scoring the tenant's whole chunk set per query.
 */
export function computeBM25Scores(query, documents, { k1 = DEFAULT_K1, b = DEFAULT_B } = {}) {
  const queryTerms = tokenize(query);

  if (queryTerms.length === 0 || documents.length === 0) {
    return documents.map((doc) => ({ id: doc.id, score: 0 }));
  }

  const docTokens = documents.map((doc) => tokenize(doc.text));
  const docLengths = docTokens.map((tokens) => tokens.length);
  const avgDocLength = docLengths.reduce((sum, len) => sum + len, 0) / documents.length;
  const N = documents.length;

  const idf = new Map();
  for (const term of new Set(queryTerms)) {
    const df = docTokens.filter((tokens) => tokens.includes(term)).length;
    idf.set(term, Math.log(1 + (N - df + 0.5) / (df + 0.5)));
  }

  const scores = documents.map((doc, i) => {
    const tokens = docTokens[i];
    const docLength = docLengths[i];

    let score = 0;
    for (const term of queryTerms) {
      const termFreq = tokens.filter((t) => t === term).length;
      if (termFreq === 0) continue;

      const numerator = termFreq * (k1 + 1);
      const denominator = termFreq + k1 * (1 - b + (b * docLength) / avgDocLength);
      score += idf.get(term) * (numerator / denominator);
    }

    return { id: doc.id, score };
  });

  return scores.sort((a, b2) => b2.score - a.score);
}
