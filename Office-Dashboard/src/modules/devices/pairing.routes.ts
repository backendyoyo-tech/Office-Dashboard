import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import {
    adminListPairings,
    adminApprovePairing,
    adminRejectPairing,
} from '@/modules/device-pairing/pairing.controller';

const router = Router();

/*
 * All device-pairing admin endpoints require:
 * 1. authenticated dashboard user
 * 2. ADMIN permission
 */
router.use(authenticate);

const requireAdmin = (req: any, res: any, next: any) => {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required',
        });
    }
    next();
};

router.use(requireAdmin);

router.get('/pairing-requests', adminListPairings);

router.post(
    '/pairing-requests/:id/approve',
    adminApprovePairing,
);

router.post(
    '/pairing-requests/:id/reject',
    adminRejectPairing,
);

export default router;