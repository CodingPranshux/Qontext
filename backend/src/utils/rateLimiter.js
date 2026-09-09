function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A continuously-refilling token bucket whose acquire() waits (instead of
 * rejecting) until enough capacity exists — for pacing our own outbound
 * calls to a rate-limited API, as opposed to infra/rateLimit/tokenBucket.js
 * which rejects *inbound* requests once a tenant's bucket is empty.
 */
export class AsyncTokenBucket {
  constructor({ capacity, refillPerSecond }) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.available = capacity;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.available = Math.min(this.capacity, this.available + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = now;
  }

  async acquire(cost) {
    // A single request costing more than the bucket ever holds would wait
    // forever — clamp so it just waits for a full bucket instead.
    const need = Math.min(cost, this.capacity);

    for (;;) {
      this._refill();
      if (this.available >= need) {
        this.available -= need;
        return;
      }
      const deficit = need - this.available;
      const waitMs = Math.ceil((deficit / this.refillPerSecond) * 1000);
      await sleep(Math.max(waitMs, 25));
    }
  }
}
