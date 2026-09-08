import { Router } from 'express';
import { requireAuth, rejectClientTenantId } from '../middleware/auth.middleware.js';
import { attachRequestContext } from '../middleware/requestContext.middleware.js';
import { perTenantRateLimit } from '../middleware/rateLimit.middleware.js';
import { postSearch } from '../controllers/query.controller.js';

const router = Router();

router.use(requireAuth, attachRequestContext, perTenantRateLimit, rejectClientTenantId);

router.post('/search', postSearch);

export default router;
