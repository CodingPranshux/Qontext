// Demonstration/test routes for Phase 1. Real protected resources (documents,
// chat, etc.) arrive in later phases and should follow the same pattern:
// mount requireAuth + rejectClientTenantId, then read req.tenantId.

export function getMe(req, res) {
  res.status(200).json({ userId: req.userId, tenantId: req.tenantId });
}

export function postEcho(req, res) {
  res.status(200).json({ userId: req.userId, tenantId: req.tenantId, body: req.body });
}
