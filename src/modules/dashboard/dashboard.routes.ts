import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/summary', (req, res, next) => dashboardController.getSummary(req, res, next));

export default router;
