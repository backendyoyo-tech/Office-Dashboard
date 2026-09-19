import { Router } from 'express';
import { platformAccountsController } from './platform-accounts.controller';
import { authenticate } from '@/middleware/auth';
import { requireEditor } from '@/middleware/rbac';

const router = Router();

router.use(authenticate);

// Platforms list - all roles
router.get('/platforms', (req, res, next) => platformAccountsController.getPlatforms(req, res, next));

// List and view - all roles
router.get('/', (req, res, next) => platformAccountsController.list(req, res, next));
router.get('/:id', (req, res, next) => platformAccountsController.getById(req, res, next));

// Create, update, archive - ADMIN/EDITOR
router.post('/', requireEditor, (req, res, next) => platformAccountsController.create(req, res, next));
router.patch('/:id', requireEditor, (req, res, next) => platformAccountsController.update(req, res, next));
router.post('/:id/archive', requireEditor, (req, res, next) => platformAccountsController.archive(req, res, next));

// Link/unlink phone to account - ADMIN/EDITOR
router.post('/:id/link-phone', requireEditor, (req, res, next) => platformAccountsController.linkPhone(req, res, next));
router.post('/:id/unlink-phone', requireEditor, (req, res, next) => platformAccountsController.unlinkPhone(req, res, next));

export default router;
