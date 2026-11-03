import { AttendanceStatus, AttendanceType } from '@app/common';
import { AttendanceLog } from '../entities/attendance-log.entity';
import { Attendance } from '../entities/attendance.entity';

/**
 * Service mengembalikan `*PhotoKey` (lokasi object di storage).
 * Gateway mengubahnya menjadi `*PhotoUrl` bertanda tangan sebelum dikirim ke browser.
 */
export interface AttendanceRecordView {
  id: string;
  employeeId: string;
  attendanceDate: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  status: AttendanceStatus;
  lateMinutes: number;
  workMinutes: number | null;
  employee: { employeeCode: string; fullName: string; departmentName: string; positionName: string };
  checkInPhotoKey: string | null;
  checkOutPhotoKey: string | null;
}

export interface AttendanceLogView {
  id: string;
  type: AttendanceType;
  recordedAt: Date;
  clientTime: Date | null;
  clockDriftSeconds: number | null;
  photoKey: string;
  photoSize: number;
  photoWidth: number;
  photoHeight: number;
  faceCount: number;
  faceConfidence: number;
  livenessPassed: boolean;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyM: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  note: string | null;
}

export interface AttendanceDetailView extends AttendanceRecordView {
  logs: AttendanceLogView[];
}

type PhotoLog = Pick<AttendanceLog, 'type' | 'photoKey'>;

export function toRecordView(attendance: Attendance, logs: PhotoLog[] = attendance.logs ?? []): AttendanceRecordView {
  const photo = (type: AttendanceType) => logs.find((log) => log.type === type)?.photoKey ?? null;
  return {
    id: attendance.id,
    employeeId: attendance.employeeId,
    attendanceDate: attendance.attendanceDate,
    checkInAt: attendance.checkInAt,
    checkOutAt: attendance.checkOutAt,
    status: attendance.status,
    lateMinutes: attendance.lateMinutes,
    workMinutes: attendance.workMinutes,
    employee: {
      employeeCode: attendance.employee?.employeeCode ?? '',
      fullName: attendance.employee?.fullName ?? '',
      departmentName: attendance.employee?.departmentName ?? '',
      positionName: attendance.employee?.positionName ?? '',
    },
    checkInPhotoKey: photo(AttendanceType.CHECK_IN),
    checkOutPhotoKey: photo(AttendanceType.CHECK_OUT),
  };
}

export function toLogView(log: AttendanceLog): AttendanceLogView {
  return {
    id: log.id,
    type: log.type,
    recordedAt: log.recordedAt,
    clientTime: log.clientTime,
    clockDriftSeconds: log.clockDriftSeconds,
    photoKey: log.photoKey,
    photoSize: log.photoSize,
    photoWidth: log.photoWidth,
    photoHeight: log.photoHeight,
    faceCount: log.faceCount,
    faceConfidence: log.faceConfidence,
    livenessPassed: log.livenessPassed,
    latitude: log.latitude,
    longitude: log.longitude,
    locationAccuracyM: log.locationAccuracyM,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    note: log.note,
  };
}

export function toDetailView(attendance: Attendance): AttendanceDetailView {
  const logs = [...(attendance.logs ?? [])].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  return { ...toRecordView(attendance, logs), logs: logs.map(toLogView) };
}
