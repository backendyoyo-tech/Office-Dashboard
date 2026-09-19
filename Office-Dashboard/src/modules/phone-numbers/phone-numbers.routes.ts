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
// REPAIR D-001 / D-009 — canonical archive verb. The frontend calls
// `DELETE /phone-numbers/:id` (mirroring `DELETE /platform-accounts/:id`).
// The legacy POST /:id/archive route is retained as a documented alias so
// existing clients and the manual SQL/API docs keep working.
router.delete('/:id', requireEditor, (req, res, next) => phoneNumbersController.archive(req, res, next));
router.post('/:id/archive', requireEditor, (req, res, next) => phoneNumbersController.archive(req, res, next));
router.post('/:id/restore', requireEditor, (req, res, next) => phoneNumbersController.restore(req, res, next));

// Phone-account links (connected accounts from phone perspective)
router.get('/:id/accounts', (req, res, next) => phoneNumbersController.listAccounts(req, res, next));
router.post('/:id/accounts', requireEditor, (req, res, next) => phoneNumbersController.linkAccount(req, res, next));
router.delete('/:id/accounts/:linkId', requireEditor, (req, res, next) => phoneNumbersController.unlinkAccount(req, res, next));

export default router;
