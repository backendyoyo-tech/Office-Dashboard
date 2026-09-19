import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/rbac';

const router = Router();

// All user management requires authentication + ADMIN role
router.use(authenticate, requireAdmin);

router.get('/', (req, res, next) => usersController.list(req, res, next));
router.get('/:id', (req, res, next) => usersController.getById(req, res, next));
router.post('/', (req, res, next) => usersController.create(req, res, next));
router.patch('/:id', (req, res, next) => usersController.update(req, res, next));
router.post('/:id/reset-password', (req, res, next) => usersController.resetPassword(req, res, next));

export default router;
