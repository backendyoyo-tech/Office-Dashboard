import { Router } from 'express';
import { phoneNumbersController } from './phone-numbers.controller';
import { authenticate } from '@/middleware/auth';
import { requireEditor } from '@/middleware/rbac';

const router = Router();

// All phone number operations require authentication
router.use(authenticate);

// List and view - all roles
router.get('/', (req, res, next) => phoneNumbersController.list(req, res, next));
router.get('/:id', (req, res, next) => phoneNumbersController.getById(req, res, next));

// Create, update, archive, restore - ADMIN/EDITOR only
router.post('/', requireEditor, (req, res, next) => phoneNumbersController.create(req, res, next));
router.patch('/:id', requireEditor, (req, res, next) => phoneNumbersController.update(req, res, next));
router.post('/:id/archive', requireEditor, (req, res, next) => phoneNumbersController.archive(req, res, next));
router.post('/:id/restore', requireEditor, (req, res, next) => phoneNumbersController.restore(req, res, next));

export default router;
