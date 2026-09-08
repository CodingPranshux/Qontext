import { describe, it, expect } from 'vitest';
import { computeBM25Scores } from '../src/services/bm25.service.js';

describe('computeBM25Scores', () => {
  it('scores a document containing the query term above one that does not', () => {
    const docs = [
      { id: 'a', text: 'The refund policy allows returns within 30 days.' },
      { id: 'b', text: 'The quarterly earnings report exceeded expectations.' },
    ];

    const scores = computeBM25Scores('refund', docs);
    const byId = Object.fromEntries(scores.map((s) => [s.id, s.score]));

    expect(byId.a).toBeGreaterThan(0);
    expect(byId.b).toBe(0);
  });

  it('is case-insensitive', () => {
    const docs = [{ id: 'a', text: 'Refund policy details.' }];
    const scores = computeBM25Scores('REFUND', docs);
    expect(scores[0].score).toBeGreaterThan(0);
  });

  it('returns zero scores when the query has no usable terms', () => {
    const docs = [{ id: 'a', text: 'anything at all' }];
    const scores = computeBM25Scores('   ', docs);
    expect(scores).toEqual([{ id: 'a', score: 0 }]);
  });

  it('returns an empty array for an empty document set', () => {
    expect(computeBM25Scores('refund', [])).toEqual([]);
  });

  it('gives diminishing returns for repeated terms (sub-linear in term frequency)', () => {
    const docs = [
      { id: 'once', text: 'refund refund refund policy details here today extra padding words' },
      { id: 'never', text: 'policy details here today extra padding words nothing relevant' },
    ];
    // Compare a doc with the term repeated 3x against itself repeated ~9x —
    // score should grow, but by much less than 3x, due to k1 saturation.
    const base = computeBM25Scores('refund', [
      { id: 'x3', text: 'refund refund refund filler filler filler filler filler filler' },
    ])[0].score;
    const more = computeBM25Scores('refund', [
      { id: 'x9', text: 'refund refund refund refund refund refund refund refund refund filler filler filler' },
    ])[0].score;

    expect(more).toBeGreaterThan(base);
    expect(more).toBeLessThan(base * 3);
  });

  it('penalizes longer documents relative to the corpus average (length normalization)', () => {
    const filler = Array(40).fill('filler').join(' ');
    const docs = [
      { id: 'short', text: `refund policy ${filler.split(' ').slice(0, 3).join(' ')}` },
      { id: 'long', text: `refund policy ${filler}` },
    ];

    const scores = computeBM25Scores('refund policy', docs);
    const byId = Object.fromEntries(scores.map((s) => [s.id, s.score]));

    expect(byId.short).toBeGreaterThan(byId.long);
  });

  it('sorts results by score descending', () => {
    const docs = [
      { id: 'low', text: 'irrelevant content about something else entirely' },
      { id: 'high', text: 'refund refund policy details' },
      { id: 'mid', text: 'a single mention of refund here' },
    ];

    const scores = computeBM25Scores('refund policy', docs);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
    expect(scores[0].id).toBe('high');
  });
});
