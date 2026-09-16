import prisma from '@/lib/db/prisma';
import argon2 from 'argon2';
import { AppError, ErrorCode, NotFoundError, ConflictError } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';
import { Request } from 'express';
import type { PaginationInput } from '@/validation/common';

/**
 * Users service — CRUD for dashboard users (ADMIN only).
 */
export class UsersService {
  async list(params: PaginationInput & { search?: string; role?: string; status?: string }) {
    const { page, pageSize, search, role, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const [data, totalCount] = await Promise.all([
      prisma.appUser.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.appUser.count({ where }),
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

  async getById(id: string) {
    const user = await prisma.appUser.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    return user;
  }

  async create(data: {
    fullName: string;
    email: string;
    password: string;
    role?: 'ADMIN' | 'EDITOR' | 'VIEWER';
  }, req: Request) {
    // Check for existing email
    const existing = await prisma.appUser.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictError(ErrorCode.DUPLICATE_ENTRY, 'A user with this email already exists');
    }

    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await prisma.appUser.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role ?? 'VIEWER',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
      req,
    });

    return user;
  }

  async update(id: string, data: {
    fullName?: string;
    email?: string;
    role?: 'ADMIN' | 'EDITOR' | 'VIEWER';
    status?: 'ACTIVE' | 'DISABLED';
  }, req: Request) {
    const user = await prisma.appUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    // Check email uniqueness if changing
    if (data.email && data.email.toLowerCase() !== user.email) {
      const existing = await prisma.appUser.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (existing) {
        throw new ConflictError(ErrorCode.DUPLICATE_ENTRY, 'A user with this email already exists');
      }
    }

    const updated = await prisma.appUser.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.email !== undefined && { email: data.email.toLowerCase() }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.status !== undefined && { status: data.status }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      metadata: { changes: data },
      req,
    });

    return updated;
  }

  async resetPassword(id: string, newPassword: string, req: Request) {
    const user = await prisma.appUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.appUser.update({
      where: { id },
      data: { passwordHash },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PASSWORD_RESET_BY_ADMIN',
      entityType: 'USER',
      entityId: id,
      req,
    });

    return { success: true };
  }
}

export const usersService = new UsersService();
