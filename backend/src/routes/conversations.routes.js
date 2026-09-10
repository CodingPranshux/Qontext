import { Router } from 'express';
import { requireAuth, rejectClientTenantId } from '../middleware/auth.middleware.js';
import { getActiveConversation, postTurn, deleteActiveConversation } from '../controllers/conversations.controller.js';

const router = Router();

router.use(requireAuth, rejectClientTenantId);

router.get('/active', getActiveConversation);
router.post('/active/turns', postTurn);
router.delete('/active', deleteActiveConversation);

export default router;
