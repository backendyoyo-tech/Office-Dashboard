import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await authService.login(email, password, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getProfile(req.user!.id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(req.user!.id, currentPassword, newPassword, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
