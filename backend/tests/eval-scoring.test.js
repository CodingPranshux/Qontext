import { describe, it, expect } from 'vitest';
import { scoreRetrieval, aggregateRetrievalScores } from '../eval/scoring.js';

describe('scoreRetrieval', () => {
  it('scores perfect precision and recall when retrieved exactly matches expected', () => {
    const result = scoreRetrieval({ expectedChunkIds: ['a', 'b'], retrievedChunkIds: ['a', 'b'] });
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
    expect(result.f1).toBe(1);
  });

  it('penalizes precision when extra, irrelevant chunks are retrieved', () => {
    const result = scoreRetrieval({ expectedChunkIds: ['a'], retrievedChunkIds: ['a', 'b', 'c'] });
    expect(result.precision).toBeCloseTo(1 / 3);
    expect(result.recall).toBe(1);
  });

  it('penalizes recall when an expected chunk is missed', () => {
    const result = scoreRetrieval({ expectedChunkIds: ['a', 'b'], retrievedChunkIds: ['a'] });
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(0.5);
  });

  it('scores 0 precision and recall when nothing relevant is retrieved', () => {
    const result = scoreRetrieval({ expectedChunkIds: ['a'], retrievedChunkIds: ['z'] });
    expect(result.precision).toBe(0);
    expect(result.recall).toBe(0);
    expect(result.f1).toBe(0);
  });

  it('defines recall as 1 when nothing was expected (nothing to miss)', () => {
    const result = scoreRetrieval({ expectedChunkIds: [], retrievedChunkIds: ['a'] });
    expect(result.recall).toBe(1);
  });

  it('defines precision as 0 when nothing was retrieved at all', () => {
    const result = scoreRetrieval({ expectedChunkIds: ['a'], retrievedChunkIds: [] });
    expect(result.precision).toBe(0);
  });

  it('ignores duplicate ids in either list', () => {
    const result = scoreRetrieval({ expectedChunkIds: ['a', 'a'], retrievedChunkIds: ['a', 'a', 'a'] });
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
  });
});

describe('aggregateRetrievalScores', () => {
  it('averages precision/recall/f1 across questions', () => {
    const scores = [
      { precision: 1, recall: 1, f1: 1 },
      { precision: 0, recall: 0, f1: 0 },
    ];
    const aggregate = aggregateRetrievalScores(scores);
    expect(aggregate.precision).toBe(0.5);
    expect(aggregate.recall).toBe(0.5);
    expect(aggregate.f1).toBe(0.5);
  });

  it('returns zeros for an empty result set rather than dividing by zero', () => {
    expect(aggregateRetrievalScores([])).toEqual({ precision: 0, recall: 0, f1: 0 });
  });
});
