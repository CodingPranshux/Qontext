import { randomUUID } from 'node:crypto';
import { runWithContext } from '../infra/logging/requestContext.js';

/**
 * Must run AFTER requireAuth so req.tenantId is already set. Generates a
 * request_id, exposes it to the client via X-Request-Id (handy for
 * correlating a support report with log lines), and stashes
 * { requestId, tenantId } in AsyncLocalStorage for logger.js to pick up
 * automatically from anywhere in this request's async call chain.
 */
export function attachRequestContext(req, res, next) {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  runWithContext({ requestId, tenantId: req.tenantId }, next);
}
