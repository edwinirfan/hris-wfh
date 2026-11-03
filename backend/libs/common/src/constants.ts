export const APP_TIMEZONE = 'Asia/Jakarta';

/** Injection tokens untuk ClientProxy */
export const AUTH_SERVICE = 'AUTH_SERVICE';
export const EMPLOYEE_SERVICE = 'EMPLOYEE_SERVICE';
export const ATTENDANCE_SERVICE = 'ATTENDANCE_SERVICE';
export const EVENTS_PUBLISHER = 'EVENTS_PUBLISHER';

/** RabbitMQ: satu topic exchange, satu queue per consumer */
export const EVENTS_EXCHANGE = 'hris.events';
export const EVENT_QUEUES = {
  AUTH: 'hris.auth-service.events',
  ATTENDANCE: 'hris.attendance-service.events',
  GATEWAY: 'hris.api-gateway.events',
} as const;

/** Request-response (TCP) */
export const AuthPatterns = {
  LOGIN: 'auth.login',
  REFRESH: 'auth.refresh',
  LOGOUT: 'auth.logout',
  CHANGE_PASSWORD: 'auth.change_password',
  ME: 'auth.me',
  CREATE_USER: 'auth.create_user',
  RESET_PASSWORD: 'auth.reset_password',
  FIND_BY_EMPLOYEE: 'auth.find_by_employee',
} as const;

export const EmployeePatterns = {
  CREATE: 'employee.create',
  FIND_ALL: 'employee.find_all',
  FIND_ONE: 'employee.find_one',
  UPDATE: 'employee.update',
  SET_STATUS: 'employee.set_status',
  COMPENSATE_DELETE: 'employee.compensate_delete',
  DEPARTMENTS: 'employee.departments',
  POSITIONS: 'employee.positions',
} as const;

export const AttendancePatterns = {
  PRECHECK: 'attendance.precheck',
  CHECK_IN: 'attendance.check_in',
  CHECK_OUT: 'attendance.check_out',
  TODAY: 'attendance.today',
  MY_HISTORY: 'attendance.my_history',
  FIND_ALL: 'attendance.find_all',
  FIND_ONE: 'attendance.find_one',
  SUMMARY: 'attendance.summary',
  STATS: 'attendance.stats',
  ABSENTEES: 'attendance.absentees',
  SCHEDULE: 'attendance.schedule',
} as const;

/** Event (RabbitMQ routing key) */
export const Events = {
  EMPLOYEE_CREATED: 'employee.created',
  EMPLOYEE_UPDATED: 'employee.updated',
  EMPLOYEE_STATUS_CHANGED: 'employee.status_changed',
  EMPLOYEE_DELETED: 'employee.deleted',
  ATTENDANCE_RECORDED: 'attendance.recorded',
} as const;

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_MIN_WIDTH = 320;
export const PHOTO_MIN_HEIGHT = 240;
export const CLOCK_DRIFT_WARNING_SECONDS = 300;
