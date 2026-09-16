import { Request, Response, NextFunction } from 'express';
import { whatsappService } from './whatsapp.service';
import { createWaSessionSchema, updateWaSessionSchema, waConfirmLinkSchema, waStatusUpdateSchema } from '@/validation/whatsapp';
import { uuidParamSchema } from '@/validation/common';

export class WhatsAppController {
  async getByPhoneNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const session = await whatsappService.getByPhoneNumber(phoneId);
      res.json(session);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const data = createWaSessionSchema.parse(req.body);
      const session = await whatsappService.create(phoneId, data, req);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const data = updateWaSessionSchema.parse(req.body);
      const session = await whatsappService.update(phoneId, data, req);
      res.json(session);
    } catch (err) {
      next(err);
    }
  }

  async disable(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const session = await whatsappService.disable(phoneId, req);
      res.json(session);
    } catch (err) {
      next(err);
    }
  }

  async setup(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const result = await whatsappService.setup(phoneId, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async open(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const result = await whatsappService.open(phoneId, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async reconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const result = await whatsappService.reconnect(phoneId, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async confirmLink(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const data = waConfirmLinkSchema.parse(req.body);
      const device = (req as any).launcherDevice;
      const session = await whatsappService.confirmLink(phoneId, data, device);
      res.json(session);
    } catch (err) {
      next(err);
    }
  }

  async statusUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneId = req.params.phoneId as string;
      const data = waStatusUpdateSchema.parse(req.body);
      const device = (req as any).launcherDevice;
      const session = await whatsappService.statusUpdate(phoneId, data, device);
      res.json(session);
    } catch (err) {
      next(err);
    }
  }
}

export const whatsappController = new WhatsAppController();
