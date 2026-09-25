import { Router } from 'express';
import {
  requestPairing,
  pairingStatus,
} from '@/modules/device-pairing/pairing.controller';

const router = Router();

/*
 * Pairing endpoints intentionally do NOT use dashboard authentication.
 *
 * The launcher authenticates the pairing operation using the
 * high-entropy pairing secret.
 */
router.post('/pair/request', requestPairing);
router.post('/pair/status', pairingStatus);

export default router;