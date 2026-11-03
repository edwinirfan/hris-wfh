import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import {
  addDays,
  APP_TIMEZONE,
  computeLateness,
  dayjs,
  DATE_FORMAT,
  demoDepartmentName,
  DEMO_EMPLOYEES,
  localDateTime,
  minutesBetween,
  toLocalDate,
} from '@app/common';
import { Attendance } from '../entities/attendance.entity';
import { EmployeeRef } from '../entities/employee-ref.entity';
import { WorkSchedule } from '../entities/work-schedule.entity';

const HISTORY_DAYS = 10;

/**
 * - Jadwal kerja default selalu dibuat bila kosong.
 * - Bila SEED_DEMO_DATA=true: replika karyawan demo + riwayat absensi hari kerja sebelumnya
 *   (tanpa foto — hanya untuk mengisi grafik & tabel monitoring saat demo).
 */
@Injectable()
export class AttendanceSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AttendanceSeeder.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if ((await manager.count(WorkSchedule)) === 0) {
        await manager.insert(WorkSchedule, {
          name: 'Jam Kerja Normal',
          workStart: '08:00:00',
          workEnd: '17:00:00',
          lateToleranceMinutes: 15,
          timezone: APP_TIMEZONE,
          isDefault: true,
        });
        this.logger.log('Seed jadwal kerja default 08:00–17:00 (toleransi 15 menit)');
      }

      if (!this.config.get<boolean>('SEED_DEMO_DATA')) return;

      if ((await manager.count(EmployeeRef)) === 0) {
        await manager.insert(
          EmployeeRef,
          DEMO_EMPLOYEES.map((e) => ({
            employeeId: e.id,
            employeeCode: e.employeeCode,
            fullName: e.fullName,
            departmentId: e.departmentId,
            departmentName: demoDepartmentName(e.departmentId),
            positionName: e.positionName,
            isActive: e.isActive,
          })),
        );
      }

      if ((await manager.count(Attendance)) === 0) {
        const rows = this.buildHistory();
        if (rows.length) await manager.insert(Attendance, rows);
        this.logger.log(`Seed ${rows.length} riwayat absensi demo`);
      }
    });
  }

  /** Data deterministik (berbasis hash) supaya hasil seed selalu sama */
  private buildHistory(): Partial<Attendance>[] {
    const today = toLocalDate(new Date());
    const rows: Partial<Attendance>[] = [];
    for (let offset = HISTORY_DAYS; offset >= 1; offset--) {
      const date = addDays(today, -offset);
      const weekday = dayjs(date, DATE_FORMAT, true).day();
      if (weekday === 0 || weekday === 6) continue;

      for (const employee of DEMO_EMPLOYEES.filter((e) => e.isActive)) {
        const hash = createHash('sha256').update(`${employee.id}:${date}`).digest();
        if (hash[0] % 10 === 0) continue; // ±10% tidak hadir

        const checkInAt = new Date(localDateTime(date, '07:35').getTime() + (hash[1] % 55) * 60_000);
        const checkOutAt = new Date(localDateTime(date, '17:00').getTime() + (hash[2] % 75) * 60_000);
        const lateness = computeLateness(checkInAt, '08:00', 15);
        rows.push({
          employeeId: employee.id,
          attendanceDate: date,
          checkInAt,
          checkOutAt,
          status: lateness.status,
          lateMinutes: lateness.lateMinutes,
          workMinutes: minutesBetween(checkInAt, checkOutAt),
        });
      }
    }
    return rows;
  }
}
