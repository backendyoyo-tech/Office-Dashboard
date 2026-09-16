import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  AppUser,
  PhoneNumber,
  CreatePhoneNumberRequest,
  UpdatePhoneNumberRequest,
  PlatformAccount,
  CreatePlatformAccountRequest,
  UpdatePlatformAccountRequest,
  LinkAccountRequest,
  RegisteredDevice,
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  WhatsAppSession,
  SetupWhatsAppRequest,
  ChangeDeviceRequest,
  RevealCredentialResponse,
  AuditLog,
  PaginatedResponse,
  DashboardSummary,
  PhoneNumberFilters,
  PlatformAccountFilters,
  AuditLogFilters,
  DeviceFilters,
  UserFilters,
  CreateUserRequest,
  UpdateUserRequest,
  PhoneAccountLink,
  Platform,
} from '@/types';

const API_BASE = '/api/v1';;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================
// AUTH
// ============================================================

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data).then((r) => r.data),

  me: () =>
    api.get<AppUser>('/auth/me').then((r) => r.data),
};

// ============================================================
// PHONE NUMBERS
// ============================================================

export const phoneNumbersApi = {
  list: (filters?: PhoneNumberFilters) =>
    api.get<PaginatedResponse<PhoneNumber>>('/phone-numbers', { params: filters }).then((r) => r.data),

  getById: (id: string) =>
    api.get<PhoneNumber>(`/phone-numbers/${id}`).then((r) => r.data),

  create: (data: CreatePhoneNumberRequest) =>
    api.post<PhoneNumber>('/phone-numbers', data).then((r) => r.data),

  update: (id: string, data: UpdatePhoneNumberRequest) =>
    api.patch<PhoneNumber>(`/phone-numbers/${id}`, data).then((r) => r.data),

  archive: (id: string) =>
    api.delete(`/phone-numbers/${id}`).then((r) => r.data),

  getAccounts: (phoneId: string) =>
    api.get<PhoneAccountLink[]>(`/phone-numbers/${phoneId}/accounts`).then((r) => r.data),

  linkAccount: (phoneId: string, data: LinkAccountRequest) =>
    api.post<PhoneAccountLink>(`/phone-numbers/${phoneId}/accounts`, data).then((r) => r.data),

  unlinkAccount: (phoneId: string, linkId: string) =>
    api.delete(`/phone-numbers/${phoneId}/accounts/${linkId}`).then((r) => r.data),
};

// ============================================================
// PLATFORM ACCOUNTS
// ============================================================

export const platformAccountsApi = {
  list: (filters?: PlatformAccountFilters) =>
    api.get<PaginatedResponse<PlatformAccount>>('/platform-accounts', { params: filters }).then((r) => r.data),

  getById: (id: string) =>
    api.get<PlatformAccount>(`/platform-accounts/${id}`).then((r) => r.data),

  create: (data: CreatePlatformAccountRequest) =>
    api.post<PlatformAccount>('/platform-accounts', data).then((r) => r.data),

  update: (id: string, data: UpdatePlatformAccountRequest) =>
    api.patch<PlatformAccount>(`/platform-accounts/${id}`, data).then((r) => r.data),

  archive: (id: string) =>
    api.delete(`/platform-accounts/${id}`).then((r) => r.data),

  revealCredential: (id: string) =>
    api.post<RevealCredentialResponse>(`/platform-accounts/${id}/reveal-credential`).then((r) => r.data),

  updateCredential: (id: string, password: string) =>
    api.put(`/platform-accounts/${id}/credential`, { password }).then((r) => r.data),
};

// ============================================================
// PLATFORMS
// ============================================================

export const platformsApi = {
  list: () =>
    api.get<Platform[]>('/platforms').then((r) => r.data),
};

// ============================================================
// DEVICES
// ============================================================

export const devicesApi = {
  list: (filters?: DeviceFilters) =>
    api.get<PaginatedResponse<RegisteredDevice>>('/devices', { params: filters }).then((r) => r.data),

  getById: (id: string) =>
    api.get<RegisteredDevice>(`/devices/${id}`).then((r) => r.data),

  register: (data: RegisterDeviceRequest) =>
    api.post<RegisterDeviceResponse>('/devices', data).then((r) => r.data),

  toggleEnabled: (id: string, enabled: boolean) =>
    api.patch<RegisteredDevice>(`/devices/${id}`, { enabled }).then((r) => r.data),
};

// ============================================================
// WHATSAPP SESSIONS
// ============================================================

export const whatsappApi = {
  setup: (data: SetupWhatsAppRequest) =>
    api.post<WhatsAppSession>('/whatsapp/setup', data).then((r) => r.data),

  getSession: (phoneId: string) =>
    api.get<WhatsAppSession>(`/whatsapp/sessions/${phoneId}`).then((r) => r.data),

  openSession: (sessionId: string) =>
    api.post(`/whatsapp/sessions/${sessionId}/open`).then((r) => r.data),

  reconnectSession: (sessionId: string) =>
    api.post(`/whatsapp/sessions/${sessionId}/reconnect`).then((r) => r.data),

  changeDevice: (sessionId: string, data: ChangeDeviceRequest) =>
    api.patch<WhatsAppSession>(`/whatsapp/sessions/${sessionId}/device`, data).then((r) => r.data),

  disableSession: (sessionId: string) =>
    api.post(`/whatsapp/sessions/${sessionId}/disable`).then((r) => r.data),
};

// ============================================================
// USERS
// ============================================================

export const usersApi = {
  list: (filters?: UserFilters) =>
    api.get<PaginatedResponse<AppUser>>('/users', { params: filters }).then((r) => r.data),

  getById: (id: string) =>
    api.get<AppUser>(`/users/${id}`).then((r) => r.data),

  create: (data: CreateUserRequest) =>
    api.post<AppUser>('/users', data).then((r) => r.data),

  update: (id: string, data: UpdateUserRequest) =>
    api.patch<AppUser>(`/users/${id}`, data).then((r) => r.data),
};

// ============================================================
// AUDIT LOGS
// ============================================================

export const auditLogsApi = {
  list: (filters?: AuditLogFilters) =>
    api.get<PaginatedResponse<AuditLog>>('/audit-logs', { params: filters }).then((r) => r.data),
};

// ============================================================
// DASHBOARD
// ============================================================

export const dashboardApi = {
  summary: () =>
    api.get<DashboardSummary>('/dashboard/summary').then((r) => r.data),
};

export default api;
