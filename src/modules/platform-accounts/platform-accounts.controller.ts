import { Request, Response, NextFunction } from 'express';
import { platformAccountsService } from './platform-accounts.service';
import { createAccountSchema, updateAccountSchema, listAccountSchema, linkAccountSchema } from '@/validation/platform-account';
import { uuidParamSchema } from '@/validation/common';
import { z } from 'zod';

export class PlatformAccountsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listAccountSchema.parse(req.query);
      const result = await platformAccountsService.list(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const account = await platformAccountsService.getById(id);
      res.json(account);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createAccountSchema.parse(req.body);
      const account = await platformAccountsService.create(data, req);
      res.status(201).json(account);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const data = updateAccountSchema.parse(req.body);
      const account = await platformAccountsService.update(id, data, req);
      res.json(account);
    } catch (err) {
      next(err);
    }
  }

  async linkPhone(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const { phoneNumberId, relationshipType, isPrimary } = linkAccountSchema.parse(req.body);
      const link = await platformAccountsService.linkPhone(id, phoneNumberId, relationshipType, isPrimary, req);
      res.status(201).json(link);
    } catch (err) {
      next(err);
    }
  }

  async unlinkPhone(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const { phoneNumberId } = z.object({ phoneNumberId: z.string().uuid() }).parse(req.body);
      const result = await platformAccountsService.unlinkPhone(id, phoneNumberId, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const account = await platformAccountsService.archive(id, req);
      res.json(account);
    } catch (err) {
      next(err);
    }
  }

  async getPlatforms(_req: Request, res: Response, next: NextFunction) {
    try {
      const platforms = await platformAccountsService.getPlatforms();
      res.json(platforms);
    } catch (err) {
      next(err);
    }
  }
}

export const platformAccountsController = new PlatformAccountsController();
