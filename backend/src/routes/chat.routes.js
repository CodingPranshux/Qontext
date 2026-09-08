import { Router } from 'express';
import { requireAuth, rejectClientTenantId } from '../middleware/auth.middleware.js';
import { attachRequestContext } from '../middleware/requestContext.middleware.js';
import { perTenantRateLimit } from '../middleware/rateLimit.middleware.js';
import { postAsk } from '../controllers/chat.controller.js';

const router = Router();

router.use(requireAuth, attachRequestContext, perTenantRateLimit, rejectClientTenantId);

router.post('/ask', postAsk);

export default router;
