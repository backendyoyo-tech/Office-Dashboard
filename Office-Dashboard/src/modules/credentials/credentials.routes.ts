import { Router } from 'express';
import { credentialsController } from './credentials.controller';
import { authenticate } from '@/middleware/auth';
import { requireEditor, requireRole } from '@/middleware/rbac';
import rateLimit from 'express-rate-limit';

const router = Router();

router.use(authenticate);

// Status check - all authenticated users
router.get('/:id/status', (req, res, next) => credentialsController.status(req, res, next));

// Set/replace credential - ADMIN/EDITOR only
router.post('/:id', requireEditor, (req, res, next) => credentialsController.set(req, res, next));
router.put('/:id', requireEditor, (req, res, next) => credentialsController.replace(req, res, next));

// REPAIR D-019 — isolate the credential-reveal endpoint behind its own stricter
// rate limiter so a leaked/rotted ADMIN token cannot burn through every stored
// password in a single window. The global limiter (100/15m) remains as a
// backstop; this one targets the most-sensitive operation explicitly.
const revealLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
  max: parseInt(process.env.CREDENTIAL_REVEAL_MAX ?? '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many credential reveal attempts, please try again later',
    },
  },
});

// Reveal additionally restricted to ADMIN only (most sensitive) + rate limited
router.get(
  '/:id/reveal',
  requireRole('ADMIN'),
  revealLimiter,
  (req, res, next) => credentialsController.reveal(req, res, next),
);

export default router;
