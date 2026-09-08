import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion } from '../src/services/rrf.service.js';

describe('reciprocalRankFusion', () => {
  it('matches the formula by hand for a simple two-list case (k=60)', () => {
    const list1 = ['a', 'b', 'c'];
    const list2 = ['c', 'a', 'd'];

    const fused = reciprocalRankFusion([list1, list2], { k: 60 });
    const byId = Object.fromEntries(fused.map((r) => [r.id, r.score]));

    // a: rank 1 in list1 (1/61) + rank 2 in list2 (1/62)
    expect(byId.a).toBeCloseTo(1 / 61 + 1 / 62, 10);
    // b: rank 2 in list1 only
    expect(byId.b).toBeCloseTo(1 / 62, 10);
    // c: rank 3 in list1 (1/63) + rank 1 in list2 (1/61)
    expect(byId.c).toBeCloseTo(1 / 63 + 1 / 61, 10);
    // d: rank 3 in list2 only
    expect(byId.d).toBeCloseTo(1 / 63, 10);

    expect(fused.map((r) => r.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('includes an item present in only one list (union, not intersection)', () => {
    const fused = reciprocalRankFusion([['a', 'b'], ['c']]);
    expect(fused.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ranks an item appearing near the top of both lists above one appearing in only one', () => {
    const vectorList = ['x', 'y', 'z'];
    const bm25List = ['x', 'w', 'y'];

    const fused = reciprocalRankFusion([vectorList, bm25List]);
    expect(fused[0].id).toBe('x');
  });

  it('sorts strictly by descending score', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b', 'c', 'd'],
      ['d', 'c', 'b', 'a'],
    ]);
    for (let i = 1; i < fused.length; i += 1) {
      expect(fused[i - 1].score).toBeGreaterThanOrEqual(fused[i].score);
    }
  });

  it('supports fusing more than two ranked lists', () => {
    const fused = reciprocalRankFusion([['a', 'b'], ['b', 'a'], ['a', 'c']]);
    expect(fused[0].id).toBe('a');
  });

  it('a smaller k makes rank differences matter more', () => {
    const lists = [['a', 'b']];
    const smallK = reciprocalRankFusion(lists, { k: 1 });
    const largeK = reciprocalRankFusion(lists, { k: 1000 });

    const gapSmallK = smallK[0].score - smallK[1].score;
    const gapLargeK = largeK[0].score - largeK[1].score;

    expect(gapSmallK).toBeGreaterThan(gapLargeK);
  });

  it('returns an empty array when given no lists or empty lists', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });
});
