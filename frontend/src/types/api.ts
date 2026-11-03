/** Tipe data mengikuti kontrak di docs/API.md */

export type Role = 'ADMIN_HR' | 'EMPLOYEE'
export type Gender = 'MALE' | 'FEMALE'
export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'INTERN'
export type AttendanceStatus = 'PRESENT' | 'LATE'
export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT'
export type SortOrder = 'ASC' | 'DESC'

export interface ApiEnvelope<T> {
  success: true
  message: string | null
  data: T
}

export interface ApiErrorBody {
  success: false
  statusCode: number
  message: string
  errors?: string[]
  path?: string
  timestamp?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  items: T[]
  meta: PaginationMeta
}

export interface AuthUser {
  id: string
  employeeId: string
  email: string
  role: Role
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  lockedUntil: string | null
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

export interface Department {
  id: string
  code: string
  name: string
}

export interface Position {
  id: string
  name: string
  departmentId: string
}

export interface Employee {
  id: string
  employeeCode: string
  fullName: string
  email: string
  phone: string
  gender: Gender
  birthDate: string
  joinDate: string
  employmentType: EmploymentType
  isActive: boolean
  version: number
  department: Department
  position: { id: string; name: string }
  createdAt: string
  updatedAt: string
}

export type AccountInfo = Pick<AuthUser, 'role' | 'isActive' | 'mustChangePassword' | 'lastLoginAt' | 'lockedUntil'>

export interface EmployeeDetail extends Employee {
  account: AccountInfo | null
}

export interface MeResponse {
  user: AuthUser
  employee: Employee | null
}

export interface EmployeeInput {
  employeeCode: string
  fullName: string
  email: string
  phone: string
  gender: Gender
  birthDate: string
  departmentId: string
  positionId: string
  joinDate: string
  employmentType: EmploymentType
  role?: Role
}

export type EmployeeUpdateInput = Partial<Omit<EmployeeInput, 'role'>> & { version: number }

export interface CreateEmployeeResponse {
  employee: Employee
  account: { email: string; role: Role; temporaryPassword: string }
}

export interface EmployeeListParams {
  page: number
  limit: number
  search?: string
  departmentId?: string
  isActive?: boolean
  sortBy?: 'fullName' | 'employeeCode' | 'joinDate' | 'createdAt'
  sortOrder?: SortOrder
}

export interface Schedule {
  workStart: string
  workEnd: string
  lateToleranceMinutes: number
  timezone: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  attendanceDate: string
  checkInAt: string
  checkOutAt: string | null
  status: AttendanceStatus
  lateMinutes: number
  workMinutes: number | null
  employee: {
    employeeCode: string
    fullName: string
    departmentName: string
    positionName: string
  }
  checkInPhotoUrl: string | null
  checkOutPhotoUrl: string | null
}

export interface AttendanceLog {
  id: string
  type: AttendanceType
  recordedAt: string
  clientTime: string | null
  clockDriftSeconds: number | null
  photoUrl: string
  photoSize: number
  photoWidth: number
  photoHeight: number
  faceCount: number
  faceConfidence: number
  livenessPassed: boolean
  latitude: number | null
  longitude: number | null
  locationAccuracyM: number | null
  ipAddress: string | null
  userAgent: string | null
  note: string | null
}

export interface AttendanceDetail extends AttendanceRecord {
  logs: AttendanceLog[]
}

export interface TodayAttendance {
  date: string
  serverTime: string
  schedule: Schedule
  attendance: AttendanceDetail | null
  canCheckIn: boolean
  canCheckOut: boolean
}

export interface AttendanceHistoryParams {
  page: number
  limit: number
  from?: string
  to?: string
}

export interface AttendanceListParams extends AttendanceHistoryParams {
  departmentId?: string
  employeeId?: string
  status?: AttendanceStatus
  search?: string
  sortBy?: 'attendanceDate' | 'checkInAt' | 'fullName'
  sortOrder?: SortOrder
}

export interface AttendanceSummary {
  date: string
  totalActive: number
  checkedIn: number
  onTime: number
  late: number
  notCheckedIn: number
  checkedOut: number
}

export interface AttendanceStats {
  days: { date: string; onTime: number; late: number; absent: number }[]
}

export interface Absentee {
  employeeId: string
  employeeCode: string
  fullName: string
  departmentName: string
  positionName: string
}

export interface ServerTime {
  serverTime: string
  epochMs: number
  timezone: string
}

/** Payload event Socket.IO `attendance:recorded` */
export interface AttendanceRecordedEvent {
  attendanceId: string
  employeeId: string
  employeeCode: string
  fullName: string
  departmentName: string
  type: AttendanceType
  status: AttendanceStatus
  lateMinutes: number
  attendanceDate: string
  recordedAt: string
  photoUrl: string
  livenessPassed: boolean
  faceConfidence: number
}
