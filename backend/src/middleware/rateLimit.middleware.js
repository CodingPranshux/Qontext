import { config } from '../config/index.js';
import { TokenBucketStore } from '../infra/rateLimit/tokenBucket.js';

// One bucket per tenant_id: capacity = the burst size, refilling to full
// capacity again over one window if the tenant goes quiet. Reusing the
// existing RATE_LIMIT_* env vars (windowMs/maxRequests) instead of adding a
// separate token-bucket-specific pair of config knobs.
const refillPerSecond = config.rateLimit.maxRequests / (config.rateLimit.windowMs / 1000);
const store = new TokenBucketStore({ capacity: config.rateLimit.maxRequests, refillPerSecond });

/**
 * Must run after requireAuth so req.tenantId is available — this is what
 * makes the limit per-tenant: one tenant sending a burst of requests can
 * never exhaust another tenant's bucket.
 */
export function perTenantRateLimit(req, res, next) {
  const allowed = store.consume(req.tenantId);

  if (!allowed) {
    const retryAfterSeconds = Math.ceil(1 / refillPerSecond);
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      error: { message: 'Rate limit exceeded for this tenant — try again shortly' },
    });
  }

  next();
}

// Exposed only so tests can isolate cases from each other; not used at runtime.
export function _resetRateLimitStoreForTests() {
  store.reset();
}
