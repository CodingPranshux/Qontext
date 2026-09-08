import { encode, decode } from 'gpt-tokenizer';

/**
 * Splits text into overlapping, token-bounded chunks.
 *
 * Token counting uses gpt-tokenizer's cl100k_base encoding as a consistent,
 * dependency-free proxy for "roughly how much this costs an LLM" — it won't
 * exactly match every embedding model's own tokenizer, but it's stable and
 * good enough to size chunks predictably.
 *
 * Offsets are derived by decoding token prefixes rather than string-searching
 * the source text, which is exact because decode(encode(text)) === text.
 */
export function chunkText(text, { chunkSize = 500, overlap = 50 } = {}) {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('chunkSize must be a positive integer');
  }
  if (!Number.isInteger(overlap) || overlap < 0) {
    throw new Error('overlap must be a non-negative integer');
  }
  if (overlap >= chunkSize) {
    throw new Error('overlap must be smaller than chunkSize');
  }
  if (!text || !text.trim()) {
    return [];
  }

  const tokens = encode(text);
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length);
    const chunkTokens = tokens.slice(start, end);
    const chunkStr = decode(chunkTokens);
    const startOffset = decode(tokens.slice(0, start)).length;

    chunks.push({
      index,
      text: chunkStr,
      tokenCount: chunkTokens.length,
      startOffset,
      endOffset: startOffset + chunkStr.length,
    });

    index += 1;
    if (end === tokens.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}
