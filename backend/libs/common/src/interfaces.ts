import { AttendanceStatus, AttendanceType, Role } from './enums';

/** Payload access token — diverifikasi gateway tanpa RPC ke auth-service */
export interface JwtPayload {
  sub: string;
  employeeId: string;
  email: string;
  role: Role;
  /** must change password */
  mcp: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Bentuk error yang dikirim service lewat transport (TCP) */
export interface RpcErrorPayload {
  statusCode: number;
  message: string;
  errors?: string[];
}

export interface AuthUserView {
  id: string;
  employeeId: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserView;
}

/* ---------- Event payloads ---------- */

export interface EmployeeEventPayload {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  departmentId: string;
  departmentName: string;
  positionName: string;
  isActive: boolean;
}

export interface EmployeeStatusChangedPayload {
  id: string;
  isActive: boolean;
}

export interface EmployeeDeletedPayload {
  id: string;
}

export interface AttendanceRecordedPayload {
  attendanceId: string;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  type: AttendanceType;
  status: AttendanceStatus;
  lateMinutes: number;
  attendanceDate: string;
  recordedAt: string;
  photoKey: string;
  livenessPassed: boolean;
  faceConfidence: number;
}
