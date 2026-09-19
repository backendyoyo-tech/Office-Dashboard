/**
 * Application error codes.
 * Each code maps to a stable HTTP status and human-readable message.
 */

export enum ErrorCode {
  // Auth errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // Users
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // Phone numbers
  PHONE_NOT_FOUND = 'PHONE_NOT_FOUND',
  PHONE_ARCHIVED = 'PHONE_ARCHIVED',
  PHONE_DUPLICATE = 'PHONE_DUPLICATE',

  // Platform accounts
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  PLATFORM_NOT_FOUND = 'PLATFORM_NOT_FOUND',
  ACCOUNT_ALREADY_ARCHIVED = 'ACCOUNT_ALREADY_ARCHIVED',

  // Credentials
  CREDENTIAL_NOT_FOUND = 'CREDENTIAL_NOT_FOUND',
  CREDENTIAL_ENCRYPT_ERROR = 'CREDENTIAL_ENCRYPT_ERROR',
  CREDENTIAL_DECRYPT_ERROR = 'CREDENTIAL_DECRYPT_ERROR',

  // Recovery methods
  RECOVERY_METHOD_NOT_FOUND = 'RECOVERY_METHOD_NOT_FOUND',

  // Devices (Phase 2)
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  DEVICE_OFFLINE = 'DEVICE_OFFLINE',
  DEVICE_DISABLED = 'DEVICE_DISABLED',
  DEVICE_CODE_DUPLICATE = 'DEVICE_CODE_DUPLICATE',

  // Launcher (Phase 2)
  LAUNCHER_NOT_INSTALLED = 'LAUNCHER_NOT_INSTALLED',
  LAUNCHER_OUTDATED = 'LAUNCHER_OUTDATED',
  LAUNCHER_KEY_INVALID = 'LAUNCHER_KEY_INVALID',

  // WhatsApp sessions (Phase 2)
  WA_SESSION_EXISTS = 'WA_SESSION_EXISTS',
  WA_SESSION_NOT_FOUND = 'WA_SESSION_NOT_FOUND',
  WA_SESSION_INVALID_STATE = 'WA_SESSION_INVALID_STATE',
  WA_SETUP_TIMEOUT = 'WA_SETUP_TIMEOUT',
  WA_LINK_FAILED = 'WA_LINK_FAILED',
  WA_INVALID_SESSION_ID = 'WA_INVALID_SESSION_ID',
  WA_DEVICE_MISMATCH = 'WA_DEVICE_MISMATCH',

  // Misc
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.ACCOUNT_DISABLED]: 403,

  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.DUPLICATE_ENTRY]: 409,

  [ErrorCode.USER_NOT_FOUND]: 404,

  [ErrorCode.PHONE_NOT_FOUND]: 404,
  [ErrorCode.PHONE_ARCHIVED]: 409,
  [ErrorCode.PHONE_DUPLICATE]: 409,

  [ErrorCode.ACCOUNT_NOT_FOUND]: 404,
  [ErrorCode.PLATFORM_NOT_FOUND]: 404,
  [ErrorCode.ACCOUNT_ALREADY_ARCHIVED]: 409,

  [ErrorCode.CREDENTIAL_NOT_FOUND]: 404,
  [ErrorCode.CREDENTIAL_ENCRYPT_ERROR]: 500,
  [ErrorCode.CREDENTIAL_DECRYPT_ERROR]: 500,

  [ErrorCode.RECOVERY_METHOD_NOT_FOUND]: 404,

  [ErrorCode.DEVICE_NOT_FOUND]: 404,
  [ErrorCode.DEVICE_OFFLINE]: 409,
  [ErrorCode.DEVICE_DISABLED]: 409,
  [ErrorCode.DEVICE_CODE_DUPLICATE]: 409,

  [ErrorCode.LAUNCHER_NOT_INSTALLED]: 409,
  [ErrorCode.LAUNCHER_OUTDATED]: 409,
  [ErrorCode.LAUNCHER_KEY_INVALID]: 401,

  [ErrorCode.WA_SESSION_EXISTS]: 409,
  [ErrorCode.WA_SESSION_NOT_FOUND]: 404,
  [ErrorCode.WA_SESSION_INVALID_STATE]: 409,
  [ErrorCode.WA_SETUP_TIMEOUT]: 408,
  [ErrorCode.WA_LINK_FAILED]: 500,
  [ErrorCode.WA_INVALID_SESSION_ID]: 400,
  [ErrorCode.WA_DEVICE_MISMATCH]: 403,

  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.code = code;
    this.statusCode = ERROR_HTTP_STATUS[code] ?? 500;
    this.details = details;
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(ErrorCode.VALIDATION_ERROR, 'Validation failed', details);
  }
}

export class NotFoundError extends AppError {
  constructor(code: ErrorCode, message?: string) {
    super(code, message);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode, message?: string) {
    super(code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: ErrorCode = ErrorCode.UNAUTHORIZED, message?: string) {
    super(code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: ErrorCode = ErrorCode.FORBIDDEN, message?: string) {
    super(code, message);
  }
}
