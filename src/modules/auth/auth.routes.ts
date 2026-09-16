import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Public
router.post('/login', (req, res, next) => authController.login(req, res, next));

// Authenticated
router.get('/me', authenticate, (req, res, next) => authController.getProfile(req, res, next));
router.post('/change-password', authenticate, (req, res, next) => authController.changePassword(req, res, next));

export default router;
