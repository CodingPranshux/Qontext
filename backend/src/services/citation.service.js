/**
 * Citations are only trustworthy if we verify them ourselves — the model is
 * instructed to only cite chunk_ids it was given, but instructions aren't
 * guarantees. This extracts every [chunk_id: <id>] the model wrote and keeps
 * only the ones that match a chunk_id actually present in `validChunkIds`
 * (the tenant-scoped chunks it was shown), discarding anything hallucinated.
 */
export function extractCitedChunkIds(text, validChunkIds = []) {
  const validSet = new Set(validChunkIds);
  const cited = new Set();
  const pattern = /\[chunk_id:\s*([^\]\s]+)\]/gi;

  let match = pattern.exec(text || '');
  while (match !== null) {
    const id = match[1];
    if (validSet.has(id)) cited.add(id);
    match = pattern.exec(text);
  }

  return Array.from(cited);
}
