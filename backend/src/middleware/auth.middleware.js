import { verifyToken } from '../services/auth.service.js';

/**
 * Verifies the JWT on the Authorization header and attaches req.userId /
 * req.tenantId from its payload. This is the ONLY place downstream code
 * should get a tenantId from — never req.body, req.query, or req.params.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing or invalid Authorization header' } });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.tenantId = payload.tenantId;
    next();
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
}

const FORBIDDEN_KEYS = ['tenantId', 'tenant_id'];

/**
 * tenant_id must never be accepted from the client, in any form, on any
 * protected route — not even to be silently overwritten. A request that
 * tries is rejected outright so the mistake (or attack) is visible instead
 * of masked.
 */
export function rejectClientTenantId(req, res, next) {
  const body = req.body || {};
  const query = req.query || {};

  const offendingKey = FORBIDDEN_KEYS.find(
    (key) => Object.prototype.hasOwnProperty.call(body, key) || Object.prototype.hasOwnProperty.call(query, key)
  );

  if (offendingKey) {
    return res.status(400).json({
      error: {
        message: `tenant_id is derived from the authenticated session and must not be supplied by the client (found "${offendingKey}")`,
      },
    });
  }

  next();
}
