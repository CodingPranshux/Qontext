import { describe, it, expect } from 'vitest';
import { extractCitedChunkIds } from '../src/services/citation.service.js';

describe('extractCitedChunkIds', () => {
  it('extracts a single valid citation', () => {
    const text = 'The refund policy allows 30 days [chunk_id: abc123].';
    expect(extractCitedChunkIds(text, ['abc123'])).toEqual(['abc123']);
  });

  it('extracts multiple distinct citations, deduplicated', () => {
    const text = 'Claim one [chunk_id: a]. Claim two [chunk_id: b]. Repeat [chunk_id: a].';
    expect(extractCitedChunkIds(text, ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('discards a citation that is not in the valid set (hallucinated chunk_id)', () => {
    const text = 'This claim cites [chunk_id: not-a-real-chunk].';
    expect(extractCitedChunkIds(text, ['a', 'b'])).toEqual([]);
  });

  it('returns an empty array when there are no citations', () => {
    expect(extractCitedChunkIds('No citations here at all.', ['a'])).toEqual([]);
  });

  it('is tolerant of missing/empty input', () => {
    expect(extractCitedChunkIds('', ['a'])).toEqual([]);
    expect(extractCitedChunkIds(undefined, ['a'])).toEqual([]);
  });

  it('produces correct results across repeated calls (no stale regex state)', () => {
    const validIds = ['a'];
    expect(extractCitedChunkIds('claim [chunk_id: a]', validIds)).toEqual(['a']);
    expect(extractCitedChunkIds('claim [chunk_id: a]', validIds)).toEqual(['a']);
  });
});
