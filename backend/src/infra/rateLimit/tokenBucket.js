/**
 * Classic token bucket: holds up to `capacity` tokens, refilling
 * continuously at `refillPerSecond`. Each request consumes 1 token; if none
 * are available, the caller is rate-limited. Refill is computed lazily from
 * elapsed time on each check rather than a background timer.
 */
export class TokenBucket {
  constructor({ capacity, refillPerSecond, now = () => Date.now() }) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.now = now;
    this.tokens = capacity;
    this.lastRefillAt = now();
  }

  #refill() {
    const currentTime = this.now();
    const elapsedSeconds = (currentTime - this.lastRefillAt) / 1000;
    if (elapsedSeconds <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefillAt = currentTime;
  }

  tryConsume(amount = 1) {
    this.#refill();
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }

  get availableTokens() {
    this.#refill();
    return this.tokens;
  }
}

/**
 * One bucket per key (per tenant_id, in practice). In-memory and
 * per-process — correct for a single backend instance; horizontally
 * scaling this would need a shared store (e.g. Redis, the same way the
 * semantic cache is), since each process would otherwise enforce its own
 * independent limit rather than one shared per-tenant limit.
 */
export class TokenBucketStore {
  constructor({ capacity, refillPerSecond, now }) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.now = now;
    this.buckets = new Map();
  }

  consume(key, amount = 1) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket({ capacity: this.capacity, refillPerSecond: this.refillPerSecond, now: this.now });
      this.buckets.set(key, bucket);
    }
    return bucket.tryConsume(amount);
  }

  reset() {
    this.buckets.clear();
  }
}
