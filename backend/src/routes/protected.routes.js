import { Router } from 'express';
import { requireAuth, rejectClientTenantId } from '../middleware/auth.middleware.js';
import { getMe, postEcho } from '../controllers/protected.controller.js';

const router = Router();

router.use(requireAuth, rejectClientTenantId);

router.get('/me', getMe);
router.post('/echo', postEcho);

export default router;
