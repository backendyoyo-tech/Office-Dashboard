import { Router } from 'express';
import { launcherController } from './launcher.controller';
import { launcherAuth } from '@/middleware/launcher-auth';

const router = Router();

// Register device — public (generates API key on first registration)
router.post('/register', (req, res, next) => launcherController.register(req, res, next));

// All other launcher endpoints require API key auth
router.post('/heartbeat', launcherAuth, (req, res, next) => launcherController.heartbeat(req, res, next));
router.post('/whatsapp-launch', launcherAuth, (req, res, next) => launcherController.whatsappLaunch(req, res, next));
router.post('/whatsapp-confirm', launcherAuth, (req, res, next) => launcherController.whatsappConfirm(req, res, next));
router.post('/whatsapp-status', launcherAuth, (req, res, next) => launcherController.whatsappStatus(req, res, next));

export default router;
