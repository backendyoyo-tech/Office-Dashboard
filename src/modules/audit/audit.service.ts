import prisma from '@/lib/db/prisma';
import type { PaginationInput } from '@/validation/common';

/**
 * Audit service — search and filter audit logs.
 */
export class AuditService {
  async list(params: PaginationInput & {
    search?: string;
    action?: string;
    entityType?: string;
    actorUserId?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const { page, pageSize, search, action, entityType, actorUserId, fromDate, toDate } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entityType) where.entityType = entityType;
    if (actorUserId) where.actorUserId = actorUserId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: page * pageSize < totalCount,
        hasPrevPage: page > 1,
      },
    };
  }
}

export const auditService = new AuditService();
