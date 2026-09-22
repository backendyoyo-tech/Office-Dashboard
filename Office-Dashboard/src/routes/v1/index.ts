import { Router } from 'express';
import { platformAccountsController } from '@/modules/platform-accounts/platform-accounts.controller';
import { authenticate } from '@/middleware/auth';
import authRoutes from '@/modules/auth/auth.routes';
import usersRoutes from '@/modules/users/users.routes';
import phoneNumbersRoutes from '@/modules/phone-numbers/phone-numbers.routes';
import platformAccountsRoutes from '@/modules/platform-accounts/platform-accounts.routes';
import credentialsRoutes from '@/modules/credentials/credentials.routes';
import recoveryMethodsRoutes from '@/modules/recovery-methods/recovery-methods.routes';
import dashboardRoutes from '@/modules/dashboard/dashboard.routes';
import auditRoutes from '@/modules/audit/audit.routes';
import devicesRoutes from '@/modules/devices/devices.routes';
import whatsappRoutes from '@/modules/whatsapp/whatsapp.routes';
import launcherRoutes from '@/modules/launcher/launcher.routes';
import secureLauncherRoutes from '@/modules/secure-launcher/secure-launcher.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Auth
router.use('/auth', authRoutes);

// Users management (ADMIN only)
router.use('/users', usersRoutes);

// Phone numbers
router.use('/phone-numbers', phoneNumbersRoutes);

// WhatsApp sessions (nested under phone-numbers)
router.use('/phone-numbers/:phoneId/whatsapp', whatsappRoutes);

// Platform accounts
router.use('/platform-accounts', platformAccountsRoutes);

// Credentials
router.use('/credentials', credentialsRoutes);

// Recovery methods
router.use('/recovery-methods', recoveryMethodsRoutes);

// Dashboard summary
router.use('/dashboard', dashboardRoutes);

// Platforms list (all authenticated users)
router.get('/platforms', authenticate, (req, res, next) => platformAccountsController.getPlatforms(req, res, next));

// Audit logs
router.use('/audit-logs', auditRoutes);

// Devices (Phase 2)
router.use('/devices', devicesRoutes);

// Launcher API (Phase 2)
router.use('/launcher', launcherRoutes);
router.use('/launch', secureLauncherRoutes);

export default router;
