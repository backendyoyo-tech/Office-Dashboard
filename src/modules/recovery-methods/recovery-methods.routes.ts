import { Router } from 'express';
import { recoveryMethodsController } from './recovery-methods.controller';
import { authenticate } from '@/middleware/auth';
import { requireEditor } from '@/middleware/rbac';

const router = Router();

router.use(authenticate);

// List - all roles (scoped by account)
router.get('/account/:id', (req, res, next) => recoveryMethodsController.listByAccount(req, res, next));

// Create, update, delete - ADMIN/EDITOR
router.post('/', requireEditor, (req, res, next) => recoveryMethodsController.create(req, res, next));
router.patch('/:id', requireEditor, (req, res, next) => recoveryMethodsController.update(req, res, next));
router.delete('/:id', requireEditor, (req, res, next) => recoveryMethodsController.delete(req, res, next));

export default router;
