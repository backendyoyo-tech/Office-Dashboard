import { Router } from 'express';
import { platformAccountsController } from './platform-accounts.controller';
import { credentialsController } from '@/modules/credentials/credentials.controller';
import { authenticate } from '@/middleware/auth';
import { requireEditor, requireRole } from '@/middleware/rbac';

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
// DELETE for archive (matches frontend api.delete call)
router.delete('/:id', requireEditor, (req, res, next) => platformAccountsController.archive(req, res, next));

// Link/unlink phone to account - ADMIN/EDITOR
router.post('/:id/link-phone', requireEditor, (req, res, next) => platformAccountsController.linkPhone(req, res, next));
router.post('/:id/unlink-phone', requireEditor, (req, res, next) => platformAccountsController.unlinkPhone(req, res, next));

// Credential management (scoped to platform accounts)
router.post('/:id/reveal-credential', requireRole('ADMIN'), (req, res, next) => credentialsController.reveal(req, res, next));
router.put('/:id/credential', requireEditor, (req, res, next) => credentialsController.replace(req, res, next));

export default router;
