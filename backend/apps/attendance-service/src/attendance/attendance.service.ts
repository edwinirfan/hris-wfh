import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AttendanceRecordedPayload,
  AttendanceType,
  computeLateness,
  Events,
  EventPublisher,
  isDuplicateOn,
  minutesBetween,
  PrecheckRpcDto,
  RecordAttendanceRpcDto,
  toLocalDate,
} from '@app/common';
import { ClockService } from '../common/clock.service';
import { EmployeeRefsService } from '../employee-refs/employee-refs.service';
import { AttendanceLog } from '../entities/attendance-log.entity';
import { Attendance } from '../entities/attendance.entity';
import { EmployeeRef } from '../entities/employee-ref.entity';
import { ScheduleService, ScheduleView } from '../schedule/schedule.service';
import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceDetailView } from './attendance.view';

export const ATTENDANCE_ERRORS = {
  inactive: 'Karyawan tidak aktif',
  alreadyCheckedIn: 'Anda sudah check-in hari ini',
  notCheckedIn: 'Anda belum check-in hari ini',
  alreadyCheckedOut: 'Anda sudah check-out hari ini',
  photoReused: 'Foto ini sudah pernah digunakan',
} as const;

/** Batas wajar jam perangkat; di luar ini clientTime dianggap tidak valid */
const CLIENT_TIME_MAX_DRIFT_SECONDS = 7 * 86_400;

export interface TodayStatus {
  date: string;
  serverTime: string;
  schedule: ScheduleView;
  attendance: AttendanceDetailView | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance) private readonly attendances: Repository<Attendance>,
    @InjectRepository(AttendanceLog) private readonly logs: Repository<AttendanceLog>,
    private readonly dataSource: DataSource,
    private readonly refs: EmployeeRefsService,
    private readonly schedules: ScheduleService,
    private readonly clock: ClockService,
    private readonly queries: AttendanceQueryService,
    private readonly events: EventPublisher,
  ) {}

  /** Dipanggil gateway SEBELUM upload foto, supaya foto tidak terlanjur tersimpan untuk request yang pasti ditolak */
  async precheck({ employeeId, type }: PrecheckRpcDto): Promise<{ allowed: true; attendanceDate: string }> {
    const ref = await this.refs.ensure(employeeId);
    const schedule = await this.schedules.getDefault();
    const today = toLocalDate(this.clock.now(), schedule.timezone);
    const attendance = await this.attendances.findOneBy({ employeeId, attendanceDate: today });
    assertCanRecord(type, ref, attendance);
    return { allowed: true, attendanceDate: today };
  }

  async checkIn(dto: RecordAttendanceRpcDto): Promise<AttendanceDetailView> {
    const ref = await this.refs.ensure(dto.employeeId);
    const schedule = await this.schedules.getDefault();
    const now = this.clock.now();
    const today = toLocalDate(now, schedule.timezone);
    await this.assertPhotoUnused(dto.photo.sha256);

    let attendanceId: string;
    try {
      attendanceId = await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOneBy(Attendance, { employeeId: dto.employeeId, attendanceDate: today });
        assertCanRecord(AttendanceType.CHECK_IN, ref, existing);

        const lateness = computeLateness(now, schedule.workStart, schedule.lateToleranceMinutes, schedule.timezone);
        // UNIQUE(employee_id, attendance_date) tetap menjadi pengaman terakhir dari race condition
        const attendance = await manager.save(
          manager.create(Attendance, {
            employeeId: dto.employeeId,
            attendanceDate: today,
            checkInAt: now,
            status: lateness.status,
            lateMinutes: lateness.lateMinutes,
          }),
        );
        await manager.save(manager.create(AttendanceLog, buildLog(attendance.id, AttendanceType.CHECK_IN, now, dto)));
        return attendance.id;
      });
    } catch (error) {
      throw mapDuplicate(error);
    }

    return this.afterRecord(attendanceId, AttendanceType.CHECK_IN, ref, dto);
  }

  async checkOut(dto: RecordAttendanceRpcDto): Promise<AttendanceDetailView> {
    const ref = await this.refs.ensure(dto.employeeId);
    const schedule = await this.schedules.getDefault();
    const now = this.clock.now();
    const today = toLocalDate(now, schedule.timezone);
    await this.assertPhotoUnused(dto.photo.sha256);

    let attendanceId: string;
    try {
      attendanceId = await this.dataSource.transaction(async (manager) => {
        const attendance = await manager.findOne(Attendance, {
          where: { employeeId: dto.employeeId, attendanceDate: today },
          lock: { mode: 'pessimistic_write' },
        });
        assertCanRecord(AttendanceType.CHECK_OUT, ref, attendance);

        await manager.update(Attendance, attendance!.id, {
          checkOutAt: now,
          workMinutes: minutesBetween(attendance!.checkInAt, now),
        });
        await manager.save(manager.create(AttendanceLog, buildLog(attendance!.id, AttendanceType.CHECK_OUT, now, dto)));
        return attendance!.id;
      });
    } catch (error) {
      throw mapDuplicate(error);
    }

    return this.afterRecord(attendanceId, AttendanceType.CHECK_OUT, ref, dto);
  }

  async today(employeeId: string): Promise<TodayStatus> {
    const schedule = await this.schedules.getDefault();
    const now = this.clock.now();
    const date = toLocalDate(now, schedule.timezone);
    const ref = await this.refs.ensure(employeeId).catch(() => null);
    const attendance = await this.attendances.findOneBy({ employeeId, attendanceDate: date });
    const isActive = ref?.isActive ?? false;

    return {
      date,
      serverTime: now.toISOString(),
      schedule,
      attendance: attendance ? await this.queries.findDetail(attendance.id) : null,
      canCheckIn: isActive && !attendance,
      canCheckOut: isActive && !!attendance && !attendance.checkOutAt,
    };
  }

  /* ---------- helpers ---------- */

  private async assertPhotoUnused(sha256: string): Promise<void> {
    if (await this.logs.existsBy({ photoSha256: sha256 })) {
      throw new ConflictException(ATTENDANCE_ERRORS.photoReused);
    }
  }

  private async afterRecord(
    attendanceId: string,
    type: AttendanceType,
    ref: EmployeeRef,
    dto: RecordAttendanceRpcDto,
  ): Promise<AttendanceDetailView> {
    const detail = await this.queries.findDetail(attendanceId);
    const log = detail.logs.find((l) => l.type === type)!;
    const payload: AttendanceRecordedPayload = {
      attendanceId,
      employeeId: ref.employeeId,
      employeeCode: ref.employeeCode,
      fullName: ref.fullName,
      departmentName: ref.departmentName,
      type,
      status: detail.status,
      lateMinutes: detail.lateMinutes,
      attendanceDate: detail.attendanceDate,
      recordedAt: log.recordedAt.toISOString(),
      photoKey: dto.photo.key,
      livenessPassed: log.livenessPassed,
      faceConfidence: log.faceConfidence,
    };
    await this.events.publish(Events.ATTENDANCE_RECORDED, payload);
    return detail;
  }
}

/* ---------- aturan bisnis (pure function, mudah diuji) ---------- */

export function assertCanRecord(type: AttendanceType, ref: EmployeeRef, attendance: Attendance | null): void {
  if (!ref.isActive) throw new ForbiddenException(ATTENDANCE_ERRORS.inactive);
  if (type === AttendanceType.CHECK_IN) {
    if (attendance) throw new ConflictException(ATTENDANCE_ERRORS.alreadyCheckedIn);
    return;
  }
  if (!attendance) throw new ConflictException(ATTENDANCE_ERRORS.notCheckedIn);
  if (attendance.checkOutAt) throw new ConflictException(ATTENDANCE_ERRORS.alreadyCheckedOut);
}

export function buildLog(
  attendanceId: string,
  type: AttendanceType,
  now: Date,
  dto: RecordAttendanceRpcDto,
): Partial<AttendanceLog> {
  const { capture, photo } = dto;
  let clientTime: Date | null = capture.clientTime ? new Date(capture.clientTime) : null;
  let clockDriftSeconds: number | null = clientTime ? Math.round((clientTime.getTime() - now.getTime()) / 1000) : null;
  if (clockDriftSeconds !== null && Math.abs(clockDriftSeconds) > CLIENT_TIME_MAX_DRIFT_SECONDS) {
    // Jam perangkat tidak masuk akal: simpan sebagai drift maksimum tanpa clientTime
    clockDriftSeconds = Math.sign(clockDriftSeconds) * CLIENT_TIME_MAX_DRIFT_SECONDS;
    clientTime = null;
  }

  return {
    attendanceId,
    type,
    recordedAt: now,
    clientTime,
    clockDriftSeconds,
    photoKey: photo.key,
    photoSha256: photo.sha256,
    photoSize: photo.size,
    photoWidth: photo.width,
    photoHeight: photo.height,
    photoMime: photo.mime,
    faceCount: capture.faceCount,
    faceConfidence: Math.round(capture.faceConfidence * 10_000) / 10_000,
    livenessPassed: capture.livenessPassed,
    latitude: capture.latitude ?? null,
    longitude: capture.longitude ?? null,
    locationAccuracyM: capture.accuracy ?? null,
    ipAddress: dto.ip ?? null,
    userAgent: dto.userAgent?.slice(0, 255) ?? null,
    note: capture.note || null,
  };
}

function mapDuplicate(error: unknown): unknown {
  if (isDuplicateOn(error, 'UQ_attendances_employee_date'))
    return new ConflictException(ATTENDANCE_ERRORS.alreadyCheckedIn);
  if (isDuplicateOn(error, 'UQ_attendance_logs_photo_sha256'))
    return new ConflictException(ATTENDANCE_ERRORS.photoReused);
  if (isDuplicateOn(error, 'UQ_attendance_logs_attendance_type')) {
    return new ConflictException(ATTENDANCE_ERRORS.alreadyCheckedOut);
  }
  return error;
}
