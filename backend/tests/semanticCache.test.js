import { describe, it, expect, beforeEach } from 'vitest';
import memorySemanticCache from '../src/infra/cache/memorySemanticCache.js';

describe('memorySemanticCache (unit)', () => {
  beforeEach(async () => {
    await memorySemanticCache.clearAll();
  });

  it('misses when nothing has been cached yet', async () => {
    const result = await memorySemanticCache.get({ tenantId: 't1', embedding: [1, 0, 0], threshold: 0.9 });
    expect(result).toBeNull();
  });

  it('hits on an identical embedding', async () => {
    await memorySemanticCache.set({ tenantId: 't1', query: 'q1', embedding: [1, 0, 0], results: ['r1'] });
    const result = await memorySemanticCache.get({ tenantId: 't1', embedding: [1, 0, 0], threshold: 0.9 });
    expect(result.results).toEqual(['r1']);
  });

  it('hits on a semantically similar (not identical) embedding above the threshold', async () => {
    await memorySemanticCache.set({ tenantId: 't1', query: 'q1', embedding: [1, 0, 0], results: ['r1'] });
    // cosine similarity([1,0,0], [0.95, 0.05, 0]) is well above 0.9
    const result = await memorySemanticCache.get({ tenantId: 't1', embedding: [0.95, 0.05, 0], threshold: 0.9 });
    expect(result.results).toEqual(['r1']);
  });

  it('misses when similarity is below the threshold', async () => {
    await memorySemanticCache.set({ tenantId: 't1', query: 'q1', embedding: [1, 0, 0], results: ['r1'] });
    const result = await memorySemanticCache.get({ tenantId: 't1', embedding: [0, 1, 0], threshold: 0.9 });
    expect(result).toBeNull();
  });

  it('never returns another tenant\'s cached entry, even for an identical embedding', async () => {
    await memorySemanticCache.set({ tenantId: 'tenantA', query: 'q1', embedding: [1, 0, 0], results: ['secret'] });
    const result = await memorySemanticCache.get({ tenantId: 'tenantB', embedding: [1, 0, 0], threshold: 0.9 });
    expect(result).toBeNull();
  });

  it('respects TTL — an expired entry is not returned', async () => {
    await memorySemanticCache.set({
      tenantId: 't1',
      query: 'q1',
      embedding: [1, 0, 0],
      results: ['r1'],
      ttlSeconds: -1, // already expired
    });
    const result = await memorySemanticCache.get({ tenantId: 't1', embedding: [1, 0, 0], threshold: 0.9 });
    expect(result).toBeNull();
  });
});
