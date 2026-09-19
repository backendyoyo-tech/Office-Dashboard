import prisma from '@/lib/db/prisma';
import { AppError, ConflictError, ErrorCode, NotFoundError } from '@/types/errors';

/**
 * Optimistic locking / stale-write detection (REPAIR: D-006, FR-018).
 *
 * FR-018 requires that updates detect stale writes "or at minimum return latest
 * updated_at and prevent silent destructive overwrites".
 *
 * Strategy (canonical):
 *  - Every mutable entity carries an integer `version` starting at 1.
 *  - Clients echo the `version` they last read on every mutating request.
 *  - The server performs a conditional write (`WHERE id = ? AND version = ?`)
 *    and increments `version` atomically.
 *  - If zero rows matched, the write is rejected with 409 CONCURRENCY_CONFLICT
 *    and the response payload includes the *current* server state so the client
 *    can reconcile instead of silently clobbering another user's change.
 *  - Missing or malformed versions are rejected before a database write.
 *  - Conflict responses contain only the current id/version, never raw rows.
 *  - The conditional update and returned-row read share a transaction.
 */

export interface ConcurrencyOptions {
  /** Model delegate key on the Prisma client, e.g. 'phoneNumber'. */
  model: string;
  /** Row id. */
  id: string;
  /** Version the client believes is current. */
  expectedVersion?: number | null;
  /** Fields to write. */
  data: Record<string, any>;
  /** Extra `where` clauses (e.g. archivedAt: null). */
  extraWhere?: Record<string, any>;
  /** Fields to return alongside the updated row. */
  include?: Record<string, any>;
}

export class ConcurrencyConflictError extends ConflictError {
  constructor(message: string, public readonly current: any = null) {
    super(ErrorCode.CONCURRENCY_CONFLICT, message);
    (this as any).details = { current };
  }
}

/**
 * Perform a version-checked update.
 *
 * Returns the updated row (with the incremented version) on success.
 * Throws ConcurrencyConflictError when the version does not match.
 */
export function requireVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'A positive integer version from the last read is required');
  }
  return value;
}

export async function updateWithVersion(opts: ConcurrencyOptions) {
  const version = requireVersion(opts.expectedVersion);
  return prisma.$transaction(async tx => {
    const delegate = (tx as any)[opts.model];
    if (!delegate) throw new Error(`Unknown Prisma model delegate: ${opts.model}`);

    const result = await delegate.updateMany({
      where: { ...opts.extraWhere, id: opts.id, version },
      data: { ...opts.data, version: { increment: 1 } },
    });

    if (result.count !== 1) {
      // Only safe concurrency metadata may leave this layer. Raw rows may
      // contain password hashes, encryption material or launcher key hashes.
      const current = await delegate.findUnique({
        where: { id: opts.id }, select: { id: true, version: true },
      });
      if (!current) throw new NotFoundError(ErrorCode.NOT_FOUND, 'Record not found');
      throw new ConcurrencyConflictError('Record changed; reload before saving again', current);
    }

    // The transaction holds the row lock until this read and commit complete,
    // so the response cannot accidentally describe a later writer's changes.
    return delegate.findUniqueOrThrow({
      where: { id: opts.id }, ...(opts.include ? { include: opts.include } : {}),
    });
  });
}

/**
 * Guard used on read-modify-write flows that are not simple UPDATEs
 * (e.g. archive which toggles status).
 */
export async function assertVersion(model: string, id: string, expectedVersion?: number | null) {
  requireVersion(expectedVersion);
  const row = await (prisma as any)[model].findUnique({ where: { id }, select: { id: true, version: true } });
  if (row && row.version !== expectedVersion) {
    throw new ConcurrencyConflictError(
      `Stale write detected: expected version ${expectedVersion} but the record is at version ${row.version}.`,
      row,
    );
  }
  return row;
}
