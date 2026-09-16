import { Request, Response, NextFunction } from 'express';
import { phoneNumbersService } from './phone-numbers.service';
import { createPhoneSchema, updatePhoneSchema, listPhoneSchema } from '@/validation/phone-number';
import { uuidParamSchema } from '@/validation/common';

export class PhoneNumbersController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listPhoneSchema.parse(req.query);
      const result = await phoneNumbersService.list(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const phone = await phoneNumbersService.getById(id);
      res.json(phone);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createPhoneSchema.parse(req.body);
      const phone = await phoneNumbersService.create(data, req);
      res.status(201).json(phone);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const data = updatePhoneSchema.parse(req.body);
      const phone = await phoneNumbersService.update(id, data, req);
      res.json(phone);
    } catch (err) {
      next(err);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const phone = await phoneNumbersService.archive(id, req);
      res.json(phone);
    } catch (err) {
      next(err);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const phone = await phoneNumbersService.restore(id, req);
      res.json(phone);
    } catch (err) {
      next(err);
    }
  }
}

export const phoneNumbersController = new PhoneNumbersController();
