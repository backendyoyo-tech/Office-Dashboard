import { Router } from 'express';
import { credentialsController } from './credentials.controller';
import { authenticate } from '@/middleware/auth';
import { requireEditor, requireRole } from '@/middleware/rbac';

const router = Router();

router.use(authenticate);

// Status check - all authenticated users
router.get('/:id/status', (req, res, next) => credentialsController.status(req, res, next));

// Set/reveal/reveal - ADMIN/EDITOR only
// Reveal additionally restricted to ADMIN only (most sensitive)
router.post('/:id', requireEditor, (req, res, next) => credentialsController.set(req, res, next));
router.put('/:id', requireEditor, (req, res, next) => credentialsController.replace(req, res, next));
router.get('/:id/reveal', requireRole('ADMIN'), (req, res, next) => credentialsController.reveal(req, res, next));

export default router;
