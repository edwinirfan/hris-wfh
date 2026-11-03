import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, AttendanceType, RecordAttendanceRpcDto } from '@app/common';
import { Attendance } from '../entities/attendance.entity';
import { EmployeeRef } from '../entities/employee-ref.entity';
import { ATTENDANCE_ERRORS, AttendanceService, assertCanRecord, buildLog } from './attendance.service';

const ref = (isActive = true) => ({ employeeId: 'e1', isActive }) as EmployeeRef;
const attendance = (checkOutAt: Date | null = null) =>
  ({ id: 'a1', checkInAt: new Date('2026-11-02T01:00:00Z'), checkOutAt }) as Attendance;

describe('assertCanRecord', () => {
  it('karyawan nonaktif ditolak (403)', () => {
    expect(() => assertCanRecord(AttendanceType.CHECK_IN, ref(false), null)).toThrow(ForbiddenException);
  });

  it('check-in pertama hari ini diizinkan', () => {
    expect(() => assertCanRecord(AttendanceType.CHECK_IN, ref(), null)).not.toThrow();
  });

  it('check-in kedua di hari yang sama ditolak', () => {
    expect(() => assertCanRecord(AttendanceType.CHECK_IN, ref(), attendance())).toThrow(
      new ConflictException(ATTENDANCE_ERRORS.alreadyCheckedIn),
    );
  });

  it('check-out tanpa check-in ditolak', () => {
    expect(() => assertCanRecord(AttendanceType.CHECK_OUT, ref(), null)).toThrow(
      new ConflictException(ATTENDANCE_ERRORS.notCheckedIn),
    );
  });

  it('check-out kedua ditolak', () => {
    expect(() => assertCanRecord(AttendanceType.CHECK_OUT, ref(), attendance(new Date()))).toThrow(
      new ConflictException(ATTENDANCE_ERRORS.alreadyCheckedOut),
    );
  });
});

describe('buildLog', () => {
  const now = new Date('2026-11-02T01:30:00.000Z');
  const dto = (clientTime?: string) =>
    ({
      employeeId: 'e1',
      photo: { key: 'k', sha256: 'a'.repeat(64), size: 1000, width: 640, height: 480, mime: 'image/jpeg' },
      capture: { faceCount: 1, faceConfidence: 0.912345, livenessPassed: true, clientTime },
      ip: '10.0.0.1',
      userAgent: 'x'.repeat(400),
    }) as RecordAttendanceRpcDto;

  it('memakai jam server dan menghitung selisih jam perangkat', () => {
    const log = buildLog('a1', AttendanceType.CHECK_IN, now, dto('2026-11-02T01:32:00.000Z'));
    expect(log.recordedAt).toBe(now);
    expect(log.clockDriftSeconds).toBe(120);
    expect(log.faceConfidence).toBe(0.9123);
    expect(log.userAgent).toHaveLength(255);
    expect(log.latitude).toBeNull();
  });

  it('jam perangkat yang tidak masuk akal tidak disimpan sebagai clientTime', () => {
    const log = buildLog('a1', AttendanceType.CHECK_IN, now, dto('1999-01-01T00:00:00.000Z'));
    expect(log.clientTime).toBeNull();
    expect(log.clockDriftSeconds).toBe(-7 * 86_400);
  });
});

describe('AttendanceService.precheck — tanggal mengikuti zona waktu Asia/Jakarta', () => {
  function setup(now: Date) {
    const attendances = { findOneBy: jest.fn().mockResolvedValue(null) };
    const service = new AttendanceService(
      attendances as never,
      {} as never,
      {} as never,
      { ensure: jest.fn().mockResolvedValue(ref()) } as never,
      {
        getDefault: jest.fn().mockResolvedValue({
          workStart: '08:00',
          workEnd: '17:00',
          lateToleranceMinutes: 15,
          timezone: 'Asia/Jakarta',
        }),
      } as never,
      { now: () => now },
      {} as never,
      {} as never,
    );
    return { service, attendances };
  }

  it('pukul 06:30 WIB (23:30 UTC hari sebelumnya) tercatat di tanggal WIB', async () => {
    const { service, attendances } = setup(new Date('2026-11-01T23:30:00Z'));
    const result = await service.precheck({ employeeId: 'e1', type: AttendanceType.CHECK_IN });
    expect(result.attendanceDate).toBe('2026-11-02');
    expect(attendances.findOneBy).toHaveBeenCalledWith({ employeeId: 'e1', attendanceDate: '2026-11-02' });
  });

  it('menolak check-in bila sudah ada absensi hari ini', async () => {
    const { service, attendances } = setup(new Date('2026-11-02T02:00:00Z'));
    attendances.findOneBy.mockResolvedValue({ ...attendance(), status: AttendanceStatus.PRESENT });
    await expect(service.precheck({ employeeId: 'e1', type: AttendanceType.CHECK_IN })).rejects.toThrow(
      ATTENDANCE_ERRORS.alreadyCheckedIn,
    );
  });
});
