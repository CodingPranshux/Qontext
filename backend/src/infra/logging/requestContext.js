import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Carries { requestId, tenantId } across the async call chain of a single
 * request, without passing those two values as extra parameters through
 * every function in the Phase 2-4 pipeline. Set once per request by
 * middleware/requestContext.middleware.js; read anywhere downstream
 * (notably by logger.js) via getContext().
 */
const storage = new AsyncLocalStorage();

export function runWithContext(context, fn) {
  return storage.run(context, fn);
}

export function getContext() {
  return storage.getStore();
}
