import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

vi.mock('../../src/modules/phone-numbers/phone-numbers.service', () => ({
  phoneNumbersService: { archive: vi.fn(), restore: vi.fn() },
}));

import { phoneNumbersController } from '../../src/modules/phone-numbers/phone-numbers.controller';
import { phoneNumbersService } from '../../src/modules/phone-numbers/phone-numbers.service';

const id = '11111111-1111-4111-8111-111111111111';

describe('D-001/D-006/D-009 archive and restore request regression', () => {
  beforeEach(() => vi.clearAllMocks());

  for (const action of ['archive', 'restore'] as const) {
    for (const scenario of [
      { name: 'absent body', body: undefined, query: {}, expected: undefined },
      { name: 'empty body', body: {}, query: {}, expected: undefined },
      { name: 'body version', body: { version: 3 }, query: {}, expected: 3 },
      { name: 'query version', body: undefined, query: { version: '4' }, expected: 4 },
    ]) {
      it(`${action} forwards ${scenario.name} without a TypeError`, async () => {
        const req = { params: { id }, body: scenario.body, query: scenario.query } as unknown as Request;
        const json = vi.fn();
        const next = vi.fn();
        vi.mocked(phoneNumbersService[action]).mockResolvedValue({ id } as never);
        await phoneNumbersController[action](req, { json } as unknown as Response, next);
        expect(next).not.toHaveBeenCalled();
        expect(phoneNumbersService[action]).toHaveBeenCalledWith(id, req, scenario.expected);
        expect(json).toHaveBeenCalledWith({ id });
      });
    }

    for (const version of [0, -1, 1.5, '', null, 'invalid', true, [], {}]) {
      it(`${action} rejects malformed version ${JSON.stringify(version)} before mutation`, async () => {
        const req = { params: { id }, body: { version }, query: {} } as unknown as Request;
        const next = vi.fn();
        await phoneNumbersController[action](req, { json: vi.fn() } as unknown as Response, next);
        expect(phoneNumbersService[action]).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(expect.any(ZodError));
      });
    }
  }
});
