import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  async getSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await dashboardService.getSummary();
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
