import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { z } from 'zod';
import { paginationSchema } from '@/validation/common';

const createUserSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).default('VIEWER'),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export class UsersController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = paginationSchema.extend({
        search: z.string().optional(),
        role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).optional(),
        status: z.enum(['ACTIVE', 'DISABLED']).optional(),
      }).parse(req.query);

      const result = await usersService.list(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const user = await usersService.getById(id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createUserSchema.parse(req.body);
      const user = await usersService.create(data, req);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = updateUserSchema.parse(req.body);
      const user = await usersService.update(id, data, req);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { newPassword } = resetPasswordSchema.parse(req.body);
      const result = await usersService.resetPassword(id, newPassword, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const usersController = new UsersController();
