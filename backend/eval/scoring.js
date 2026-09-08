/**
 * Retrieval precision/recall/F1 for one question, given the chunk_ids the
 * golden set says SHOULD have come back (`expectedChunkIds`) and the
 * chunk_ids retrieval actually returned (`retrievedChunkIds`).
 *
 * precision = of what we returned, how much was actually relevant?
 * recall    = of what was actually relevant, how much did we return?
 *
 * A question with no expected chunks (nothing in the corpus should answer
 * it) defines recall as 1 — there was nothing to miss.
 */
export function scoreRetrieval({ expectedChunkIds, retrievedChunkIds }) {
  const expectedSet = new Set(expectedChunkIds);
  const retrievedSet = new Set(retrievedChunkIds);

  const truePositives = [...retrievedSet].filter((id) => expectedSet.has(id)).length;

  const precision = retrievedSet.size === 0 ? 0 : truePositives / retrievedSet.size;
  const recall = expectedSet.size === 0 ? 1 : truePositives / expectedSet.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    precision,
    recall,
    f1,
    truePositives,
    expectedCount: expectedSet.size,
    retrievedCount: retrievedSet.size,
  };
}

/** Simple mean across all per-question scores — the report's headline numbers. */
export function aggregateRetrievalScores(perQueryScores) {
  const n = perQueryScores.length;
  if (n === 0) return { precision: 0, recall: 0, f1: 0 };

  const sum = (key) => perQueryScores.reduce((total, score) => total + score[key], 0);

  return {
    precision: sum('precision') / n,
    recall: sum('recall') / n,
    f1: sum('f1') / n,
  };
}
