import { Request, Response, NextFunction } from 'express';
import { credentialsService } from './credentials.service';
import { uuidParamSchema } from '@/validation/common';
import { z } from 'zod';

const setCredentialSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export class CredentialsController {
  async set(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: platformAccountId } = uuidParamSchema.parse(req.params);
      const { password } = setCredentialSchema.parse(req.body);
      const result = await credentialsService.setCredential(platformAccountId, password, req);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async replace(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: platformAccountId } = uuidParamSchema.parse(req.params);
      const { password } = setCredentialSchema.parse(req.body);
      const result = await credentialsService.replaceCredential(platformAccountId, password, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async reveal(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: platformAccountId } = uuidParamSchema.parse(req.params);
      // Set Cache-Control: no-store to prevent caching of sensitive data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');

      const result = await credentialsService.revealCredential(platformAccountId, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async status(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: platformAccountId } = uuidParamSchema.parse(req.params);
      const result = await credentialsService.getCredentialStatus(platformAccountId);
      res.json(result ?? { exists: false });
    } catch (err) {
      next(err);
    }
  }
}

export const credentialsController = new CredentialsController();
