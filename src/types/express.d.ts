import { UserRole, UserStatus } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
