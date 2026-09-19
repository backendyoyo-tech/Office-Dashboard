import { Router } from 'express';
import { devicesController } from './devices.controller';
import { authenticate } from '@/middleware/auth';
import { requireAdmin, requireEditor } from '@/middleware/rbac';

const router = Router();

router.use(authenticate);

// List and view - all roles
router.get('/', (req, res, next) => devicesController.list(req, res, next));
router.get('/:id', (req, res, next) => devicesController.getById(req, res, next));

// Create - ADMIN only
router.post('/', requireAdmin, (req, res, next) => devicesController.create(req, res, next));

// Update - ADMIN only
router.patch('/:id', requireAdmin, (req, res, next) => devicesController.update(req, res, next));

// Disable - ADMIN only
router.delete('/:id', requireAdmin, (req, res, next) => devicesController.disable(req, res, next));

// Heartbeat - uses launcher auth (overridden at route level in v1 index)
// For dashboard use, ADMIN/EDITOR can also trigger heartbeat
router.post('/:id/heartbeat', requireEditor, (req, res, next) => devicesController.heartbeat(req, res, next));

export default router;
