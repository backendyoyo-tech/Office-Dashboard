import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '@/middleware/auth';
import { requireEditor } from '@/middleware/rbac';

const router = Router({ mergeParams: true });

// Get WA session for phone — all authenticated users
router.get('/', authenticate, (req, res, next) => whatsappController.getByPhoneNumber(req, res, next));

// Create WA session — ADMIN/EDITOR
router.post('/', authenticate, requireEditor, (req, res, next) => whatsappController.create(req, res, next));

// Update WA session — ADMIN/EDITOR
router.patch('/', authenticate, requireEditor, (req, res, next) => whatsappController.update(req, res, next));

// Disable WA session — ADMIN/EDITOR
router.delete('/', authenticate, requireEditor, (req, res, next) => whatsappController.disable(req, res, next));

// Setup (launch new session) — ADMIN/EDITOR
router.post('/setup', authenticate, requireEditor, (req, res, next) => whatsappController.setup(req, res, next));

// Open existing linked session — ADMIN/EDITOR
router.post('/open', authenticate, requireEditor, (req, res, next) => whatsappController.open(req, res, next));

// Reconnect/re-link — ADMIN/EDITOR
router.post('/reconnect', authenticate, requireEditor, (req, res, next) => whatsappController.reconnect(req, res, next));

// Confirm QR link (user clicks after scanning QR) — ADMIN/EDITOR
router.post('/confirm-link', authenticate, requireEditor, (req, res, next) => whatsappController.confirmLink(req, res, next));

// Report session status — ADMIN/EDITOR
router.post('/status-update', authenticate, requireEditor, (req, res, next) => whatsappController.statusUpdate(req, res, next));

export default router;
