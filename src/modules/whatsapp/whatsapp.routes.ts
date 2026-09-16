import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '@/middleware/auth';
import { requireEditor } from '@/middleware/rbac';
import { launcherAuth } from '@/middleware/launcher-auth';

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

// Launcher confirms link — launcher auth
router.post('/confirm-link', launcherAuth, (req, res, next) => whatsappController.confirmLink(req, res, next));

// Launcher reports status — launcher auth
router.post('/status-update', launcherAuth, (req, res, next) => whatsappController.statusUpdate(req, res, next));

export default router;
