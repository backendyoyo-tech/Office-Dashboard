import { Request, Response, NextFunction } from 'express';
import { recoveryMethodsService } from './recovery-methods.service';
import { uuidParamSchema } from '@/validation/common';
import { z } from 'zod';

const createRecoverySchema = z.object({
  platformAccountId: z.string().uuid(),
  methodType: z.enum(['EMAIL', 'PHONE']),
  value: z.string().min(1).max(200),
  isPrimary: z.boolean().default(false),
});

const updateRecoverySchema = z.object({
  isPrimary: z.boolean(),
});

export class RecoveryMethodsController {
  async listByAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: platformAccountId } = uuidParamSchema.parse(req.params);
      const methods = await recoveryMethodsService.listByAccount(platformAccountId);
      res.json(methods);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createRecoverySchema.parse(req.body);
      const method = await recoveryMethodsService.create(data, req);
      res.status(201).json(method);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const data = updateRecoverySchema.parse(req.body);
      const method = await recoveryMethodsService.update(id, data, req);
      res.json(method);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const result = await recoveryMethodsService.delete(id, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const recoveryMethodsController = new RecoveryMethodsController();
