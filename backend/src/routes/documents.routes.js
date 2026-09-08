import { Router } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { requireAuth, rejectClientTenantId } from '../middleware/auth.middleware.js';
import { getDocuments, postUpload } from '../controllers/documents.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSizeBytes },
});

const router = Router();

router.use(requireAuth);

router.get('/', rejectClientTenantId, getDocuments);

// multer must run before rejectClientTenantId so req.body (multipart fields)
// is populated by the time the tenant_id check inspects it.
router.post('/upload', upload.single('file'), rejectClientTenantId, postUpload);

export default router;
