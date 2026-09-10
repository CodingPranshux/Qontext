import { Router } from 'express';
import { postSignup, postLogin, postGoogleLogin } from '../controllers/auth.controller.js';

const router = Router();

router.post('/signup', postSignup);
router.post('/login', postLogin);
router.post('/google', postGoogleLogin);

export default router;
