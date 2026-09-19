import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ update: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), transaction: vi.fn() }));
vi.mock('../../src/lib/db/prisma', () => ({ default: { $transaction: mocks.transaction } }));
import { updateWithVersion } from '../../src/lib/concurrency';

const id = '11111111-1111-4111-8111-111111111111';

describe('D-006 atomic version-checked write', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async callback => callback({
      phoneNumber: { updateMany: mocks.update, findUnique: mocks.findUnique, findUniqueOrThrow: mocks.findUniqueOrThrow },
    }));
  });

  for (const expectedVersion of [undefined, null, 0, -1, 1.5, NaN, Infinity]) {
    it(`rejects invalid/missing version ${expectedVersion} before accessing the database`, async () => {
      await expect(updateWithVersion({ model: 'phoneNumber', id, expectedVersion, data: { label: 'New' } }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  }

  it('atomically returns the updated row and increments the submitted version', async () => {
    mocks.update.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ id, version: 3, label: 'New' });
    await expect(updateWithVersion({ model: 'phoneNumber', id, expectedVersion: 2, data: { label: 'New' } }))
      .resolves.toEqual({ id, version: 3, label: 'New' });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id, version: 2 }, data: { label: 'New', version: { increment: 1 } },
    });
  });

  it('returns only safe conflict metadata when a version does not match', async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    mocks.findUnique.mockResolvedValue({ id, version: 4 });
    await expect(updateWithVersion({ model: 'phoneNumber', id, expectedVersion: 2, data: {} }))
      .rejects.toMatchObject({ code: 'CONCURRENCY_CONFLICT', details: { current: { id, version: 4 } } });
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id }, select: { id: true, version: true } });
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it('never retries a missing row with an unconditional update', async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    mocks.findUnique.mockResolvedValue(null);
    await expect(updateWithVersion({ model: 'phoneNumber', id, expectedVersion: 2, data: {} }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
});
