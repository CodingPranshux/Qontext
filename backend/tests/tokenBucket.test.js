import { describe, it, expect } from 'vitest';
import { TokenBucket, TokenBucketStore } from '../src/infra/rateLimit/tokenBucket.js';

function fakeClock(startMs = 0) {
  let current = startMs;
  const now = () => current;
  const advance = (ms) => {
    current += ms;
  };
  return { now, advance };
}

describe('TokenBucket', () => {
  it('starts full and allows consuming up to capacity', () => {
    const bucket = new TokenBucket({ capacity: 3, refillPerSecond: 1 });
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
  });

  it('refills over time at the configured rate', () => {
    const { now, advance } = fakeClock();
    const bucket = new TokenBucket({ capacity: 5, refillPerSecond: 2, now });

    for (let i = 0; i < 5; i += 1) bucket.tryConsume();
    expect(bucket.tryConsume()).toBe(false);

    advance(1000); // 1 second -> +2 tokens
    expect(bucket.availableTokens).toBeCloseTo(2, 5);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
  });

  it('never refills past capacity', () => {
    const { now, advance } = fakeClock();
    const bucket = new TokenBucket({ capacity: 3, refillPerSecond: 100, now });

    bucket.tryConsume();
    advance(60_000); // way more than enough to overflow without the cap
    expect(bucket.availableTokens).toBe(3);
  });
});

describe('TokenBucketStore', () => {
  it('isolates buckets per key — exhausting one key does not affect another', () => {
    const store = new TokenBucketStore({ capacity: 2, refillPerSecond: 0 });

    expect(store.consume('tenantA')).toBe(true);
    expect(store.consume('tenantA')).toBe(true);
    expect(store.consume('tenantA')).toBe(false);

    expect(store.consume('tenantB')).toBe(true);
    expect(store.consume('tenantB')).toBe(true);
  });

  it('reset() clears all buckets', () => {
    const store = new TokenBucketStore({ capacity: 1, refillPerSecond: 0 });
    store.consume('tenantA');
    expect(store.consume('tenantA')).toBe(false);

    store.reset();
    expect(store.consume('tenantA')).toBe(true);
  });
});
