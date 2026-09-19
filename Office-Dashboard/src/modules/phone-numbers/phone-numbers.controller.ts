import { Request, Response, NextFunction } from 'express';
import { phoneNumbersService } from './phone-numbers.service';
import { createPhoneSchema, updatePhoneSchema, listPhoneSchema, linkPhoneSchema } from '@/validation/phone-number';
import { uuidParamSchema } from '@/validation/common';
import { z } from 'zod';

/** Read an optional version without silently accepting malformed tokens. */
function parseOptionalVersion(req: Request): number | undefined {
  const raw: unknown = req.body?.version ?? req.query?.version;
  // An explicitly supplied null is invalid, not a request to skip validation.
  const value: unknown = req.body?.version === null ? null : raw;
  if (value === undefined) return undefined;
  return z.union([
    z.number(),
    z.string().regex(/^[1-9]\d*$/).transform(Number),
  ]).pipe(z.number().int().positive().safe()).parse(value);
}

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
      // REPAIR D-001 / D-009 — canonical archive verb is DELETE /phone-numbers/:id
      // (mirroring DELETE /platform-accounts/:id). The legacy
      // POST /phone-numbers/:id/archive route is retained and both accept an
      // optional optimistic-locking version.
      const version = parseOptionalVersion(req);
      const phone = await phoneNumbersService.archive(id, req, version);
      res.json(phone);
    } catch (err) {
      next(err);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = uuidParamSchema.parse(req.params);
      const version = parseOptionalVersion(req);
      const phone = await phoneNumbersService.restore(id, req, version);
      res.json(phone);
    } catch (err) {
      next(err);
    }
  }

  async listAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: phoneId } = uuidParamSchema.parse(req.params);
      const links = await phoneNumbersService.listAccounts(phoneId);
      res.json(links);
    } catch (err) {
      next(err);
    }
  }

  async linkAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: phoneId } = uuidParamSchema.parse(req.params);
      const data = linkPhoneSchema.parse(req.body);
      const link = await phoneNumbersService.linkAccount(phoneId, data, req);
      res.status(201).json(link);
    } catch (err) {
      next(err);
    }
  }

  async unlinkAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: phoneId } = uuidParamSchema.parse(req.params);
      const { linkId } = z.object({ linkId: z.string().uuid() }).parse(req.params);
      const result = await phoneNumbersService.unlinkAccount(phoneId, linkId, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const phoneNumbersController = new PhoneNumbersController();
