import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import protectedRoutes from './protected.routes.js';
import documentsRoutes from './documents.routes.js';
import queryRoutes from './query.routes.js';
import chatRoutes from './chat.routes.js';
import conversationsRoutes from './conversations.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/protected', protectedRoutes);
router.use('/documents', documentsRoutes);
router.use('/query', queryRoutes);
router.use('/chat', chatRoutes);
router.use('/conversations', conversationsRoutes);

export default router;
