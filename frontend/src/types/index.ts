// Types matching the backend Prisma schema and API DTOs

// ============================================================
// ENUMS
// ============================================================

export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum PhoneStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOGIN_ISSUE = 'LOGIN_ISSUE',
  SUSPENDED = 'SUSPENDED',
  UNKNOWN = 'UNKNOWN',
}

export enum RecoveryMethodType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
}

export enum RelationshipType {
  GENERAL = 'GENERAL',
  LOGIN = 'LOGIN',
  RECOVERY = 'RECOVERY',
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  UNKNOWN = 'UNKNOWN',
  DISABLED = 'DISABLED',
}

export enum WhatsAppSessionStatus {
  SETUP_REQUIRED = 'SETUP_REQUIRED',
  LINKING = 'LINKING',
  LINKED = 'LINKED',
  RELOGIN_REQUIRED = 'RELOGIN_REQUIRED',
  DISABLED = 'DISABLED',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================
// MODELS
// ============================================================

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhoneNumber {
  id: string;
  e164Number: string;
  countryCode: string;
  nationalNumber: string;
  simProvider: string | null;
  label: string | null;
  status: PhoneStatus;
  notes: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  whatsappSession?: WhatsAppSession | null;
  accountLinks?: PhoneAccountLink[];
}

export interface Platform {
  id: number;
  slug: string;
  displayName: string;
  iconKey: string | null;
  isActive: boolean;
}

export interface PlatformAccount {
  id: string;
  platformId: number;
  displayName: string | null;
  accountHandle: string | null;
  loginIdentifier: string | null;
  profileUrl: string | null;
  externalAccountId: string | null;
  accountStatus: AccountStatus;
  notes: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  platform?: Platform;
  credential?: AccountCredential | null;
  recoveryMethods?: AccountRecoveryMethod[];
  accountLinks?: PhoneAccountLink[];
}

export interface PhoneAccountLink {
  id: string;
  phoneNumberId: string;
  platformAccountId: string;
  relationshipType: RelationshipType;
  isPrimary: boolean;
  linkedBy: string;
  linkedAt: string;
  phoneNumber?: PhoneNumber;
  platformAccount?: PlatformAccount;
}

export interface AccountCredential {
  id: string;
  platformAccountId: string;
  keyVersion: number;
  secretUpdatedBy: string;
  secretUpdatedAt: string;
  createdAt: string;
  // NOTE: passwordCiphertext, nonce, authTag are NEVER sent to frontend
  hasCredential: boolean;
}

export interface AccountRecoveryMethod {
  id: string;
  platformAccountId: string;
  methodType: RecoveryMethodType;
  valueNormalized: string;
  isPrimary: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor?: Pick<AppUser, 'id' | 'fullName' | 'email'> | null;
}

// ============================================================
// PHASE 2 - WhatsApp & Devices
// ============================================================

export interface RegisteredDevice {
  id: string;
  deviceCode: string;
  friendlyName: string;
  hostname: string | null;
  status: DeviceStatus;
  launcherVersion: string | null;
  lastSeenAt: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppSession {
  id: string;
  sessionCode: string;
  phoneNumberId: string;
  deviceId: string;
  status: WhatsAppSessionStatus;
  sessionDirectory: string;
  linkedAt: string | null;
  lastOpenedAt: string | null;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  device?: RegisteredDevice;
}

export interface WhatsappAuditLog {
  id: string;
  whatsappSessionId: string | null;
  deviceId: string | null;
  action: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

// ============================================================
// API REQUEST / RESPONSE DTOs
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AppUser;
}

export interface CreatePhoneNumberRequest {
  phoneNumber: string;
  countryCode: string;
  nationalNumber: string;
  simProvider?: string;
  label?: string;
  status?: PhoneStatus;
  notes?: string;
  whatsapp?: {
    enabled: boolean;
    deviceId?: string;
  };
}

export interface UpdatePhoneNumberRequest {
  simProvider?: string;
  label?: string;
  status?: PhoneStatus;
  notes?: string;
}

export interface CreatePlatformAccountRequest {
  platformId: number;
  displayName?: string;
  accountHandle?: string;
  loginIdentifier?: string;
  profileUrl?: string;
  externalAccountId?: string;
  accountStatus?: AccountStatus;
  notes?: string;
  password?: string;
}

export interface UpdatePlatformAccountRequest {
  displayName?: string;
  accountHandle?: string;
  loginIdentifier?: string;
  profileUrl?: string;
  externalAccountId?: string;
  accountStatus?: AccountStatus;
  notes?: string;
}

export interface LinkAccountRequest {
  platformAccountId: string;
  relationshipType?: RelationshipType;
  isPrimary?: boolean;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
}

export interface RegisterDeviceRequest {
  deviceCode: string;
  friendlyName: string;
  hostname?: string;
}

export interface RegisterDeviceResponse extends RegisteredDevice {
  apiKey: string; // Shown once, never again
}

export interface SetupWhatsAppRequest {
  phoneNumberId: string;
  deviceId: string;
}

export interface ChangeDeviceRequest {
  newDeviceId: string;
}

export interface RevealCredentialResponse {
  password: string;
  expiresAt: string;
}

// ============================================================
// PAGINATION & QUERY
// ============================================================

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardSummary {
  totalNumbers: number;
  activeNumbers: number;
  connectedAccounts: number;
  incompleteNumbers: number;
  loginIssueAccounts: number;
  whatsappLinked: number;
  whatsappSetupRequired: number;
  whatsappError: number;
  whatsappDisabled: number;
  recentActivity: AuditLog[];
}

export interface PhoneNumberFilters extends PaginationParams, SortParams {
  search?: string;
  status?: PhoneStatus;
  whatsappStatus?: WhatsAppSessionStatus;
}

export interface PlatformAccountFilters extends PaginationParams, SortParams {
  search?: string;
  platformId?: number;
  accountStatus?: AccountStatus;
}

export interface AuditLogFilters extends PaginationParams, SortParams {
  search?: string;
  action?: string;
  entityType?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
}

export interface DeviceFilters extends PaginationParams, SortParams {
  search?: string;
  status?: DeviceStatus;
  enabled?: boolean;
}

export interface UserFilters extends PaginationParams, SortParams {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}
