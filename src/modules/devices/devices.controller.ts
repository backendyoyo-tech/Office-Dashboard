import { Request, Response, NextFunction } from 'express';
import { devicesService } from './devices.service';
import { createDeviceSchema, updateDeviceSchema, listDeviceSchema } from '@/validation/device';
import { uuidParamSchema } from '@/validation/common';

export class DevicesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listDeviceSchema.parse(req.query);
      const result = await devicesService.list(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const device = await devicesService.getById(id);
      res.json(device);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createDeviceSchema.parse(req.body);
      const device = await devicesService.create(data, req);
      res.status(201).json(device);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const data = updateDeviceSchema.parse(req.body);
      const device = await devicesService.update(id, data, req);
      res.json(device);
    } catch (err) {
      next(err);
    }
  }

  async disable(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const device = await devicesService.disable(id, req);
      res.json(device);
    } catch (err) {
      next(err);
    }
  }

  async heartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const { launcherVersion, hostname } = req.body || {};
      const result = await devicesService.heartbeat(id, { launcherVersion, hostname });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const devicesController = new DevicesController();
