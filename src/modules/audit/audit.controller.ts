import { Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service';
import { paginationSchema } from '@/validation/common';
import { z } from 'zod';

export class AuditController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = paginationSchema.extend({
        search: z.string().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        actorUserId: z.string().uuid().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }).parse(req.query);

      const result = await auditService.list(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const auditController = new AuditController();
