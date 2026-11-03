import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import {
  addDays,
  AttendanceQueryDto,
  AttendanceStatus,
  dayjs,
  DATE_FORMAT,
  DateQueryDto,
  diffDays,
  FindAttendanceRpcDto,
  MyHistoryRpcDto,
  Paginated,
  Role,
  StatsQueryDto,
  toLocalDate,
} from '@app/common';
import { ClockService } from '../common/clock.service';
import { AttendanceLog } from '../entities/attendance-log.entity';
import { Attendance } from '../entities/attendance.entity';
import { EmployeeRef } from '../entities/employee-ref.entity';
import { ScheduleService } from '../schedule/schedule.service';
import { AttendanceDetailView, AttendanceRecordView, toDetailView, toRecordView } from './attendance.view';

const MAX_RANGE_DAYS = 366;
const SORT_COLUMNS: Record<AttendanceQueryDto['sortBy'], string> = {
  attendanceDate: 'attendance.attendanceDate',
  checkInAt: 'attendance.checkInAt',
  fullName: 'employee.fullName',
};
const ABSENT_FILTER =
  'NOT EXISTS (SELECT 1 FROM attendances a WHERE a.employee_id = ref.employee_id AND a.attendance_date = :date)';

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export interface AttendanceSummary {
  date: string;
  totalActive: number;
  checkedIn: number;
  onTime: number;
  late: number;
  notCheckedIn: number;
  checkedOut: number;
}

export interface AttendanceStats {
  days: { date: string; onTime: number; late: number; absent: number; isWeekend: boolean }[];
}

/** Sisi baca (monitoring HR & riwayat karyawan) */
@Injectable()
export class AttendanceQueryService {
  constructor(
    @InjectRepository(Attendance) private readonly attendances: Repository<Attendance>,
    @InjectRepository(AttendanceLog) private readonly logs: Repository<AttendanceLog>,
    @InjectRepository(EmployeeRef) private readonly refs: Repository<EmployeeRef>,
    private readonly schedules: ScheduleService,
    private readonly clock: ClockService,
  ) {}

  async findDetail(id: string): Promise<AttendanceDetailView> {
    const attendance = await this.attendances.findOne({
      where: { id },
      relations: { employee: true, logs: true },
    });
    if (!attendance) throw new NotFoundException('Data absensi tidak ditemukan');
    return toDetailView(attendance);
  }

  /** Karyawan hanya boleh melihat absensinya sendiri; selain itu dijawab 404 (tidak membocorkan keberadaan data) */
  async findOne({ id, requesterEmployeeId, requesterRole }: FindAttendanceRpcDto): Promise<AttendanceDetailView> {
    const detail = await this.findDetail(id);
    if (requesterRole !== Role.ADMIN_HR && detail.employeeId !== requesterEmployeeId) {
      throw new NotFoundException('Data absensi tidak ditemukan');
    }
    return detail;
  }

  async myHistory({ employeeId, query }: MyHistoryRpcDto): Promise<Paginated<AttendanceRecordView>> {
    const { from, to } = await this.resolveRange(query.from, query.to, 30);
    const [items, total] = await this.attendances
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.employee', 'employee')
      .where('attendance.employeeId = :employeeId', { employeeId })
      .andWhere('attendance.attendanceDate BETWEEN :from AND :to', { from, to })
      .orderBy('attendance.attendanceDate', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return this.paginate(items, total, query.page, query.limit);
  }

  async findAll(query: AttendanceQueryDto): Promise<Paginated<AttendanceRecordView>> {
    const { from, to } = await this.resolveRange(query.from, query.to, 1);
    const qb = this.attendances
      .createQueryBuilder('attendance')
      .innerJoinAndSelect('attendance.employee', 'employee')
      .where('attendance.attendanceDate BETWEEN :from AND :to', { from, to });

    if (query.departmentId) qb.andWhere('employee.departmentId = :departmentId', { departmentId: query.departmentId });
    if (query.employeeId) qb.andWhere('attendance.employeeId = :employeeId', { employeeId: query.employeeId });
    if (query.status) qb.andWhere('attendance.status = :status', { status: query.status });
    if (query.search) {
      const term = `%${escapeLike(query.search)}%`;
      qb.andWhere(
        new Brackets((where) =>
          where.where('employee.fullName LIKE :term', { term }).orWhere('employee.employeeCode LIKE :term', { term }),
        ),
      );
    }

    const [items, total] = await qb
      .orderBy(SORT_COLUMNS[query.sortBy], query.sortOrder)
      .addOrderBy('attendance.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return this.paginate(items, total, query.page, query.limit);
  }

  async summary({ date: requested }: DateQueryDto): Promise<AttendanceSummary> {
    const date = requested ?? (await this.today());
    const rows = await this.attendances
      .createQueryBuilder('attendance')
      .select('attendance.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(attendance.check_out_at IS NOT NULL)', 'checkedOut')
      .where('attendance.attendanceDate = :date', { date })
      .groupBy('attendance.status')
      .getRawMany<{ status: AttendanceStatus; total: string; checkedOut: string }>();

    const count = (status: AttendanceStatus) => Number(rows.find((r) => r.status === status)?.total ?? 0);
    const onTime = count(AttendanceStatus.PRESENT);
    const late = count(AttendanceStatus.LATE);
    const [totalActive, notCheckedIn] = await Promise.all([
      this.refs.countBy({ isActive: true }),
      this.refs.createQueryBuilder('ref').where('ref.isActive = 1').andWhere(ABSENT_FILTER, { date }).getCount(),
    ]);

    return {
      date,
      totalActive,
      checkedIn: onTime + late,
      onTime,
      late,
      notCheckedIn,
      checkedOut: rows.reduce((sum, r) => sum + Number(r.checkedOut ?? 0), 0),
    };
  }

  /**
   * Rekap N hari terakhir. "absent" = karyawan aktif saat ini yang tidak absen pada hari kerja
   * (hari Sabtu/Minggu tidak dihitung tidak hadir).
   */
  async stats({ days }: StatsQueryDto): Promise<AttendanceStats> {
    const end = await this.today();
    const start = addDays(end, -(days - 1));
    const rows = await this.attendances
      .createQueryBuilder('attendance')
      .select('attendance.attendanceDate', 'date')
      .addSelect('attendance.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('attendance.attendanceDate BETWEEN :start AND :end', { start, end })
      .groupBy('attendance.attendanceDate')
      .addGroupBy('attendance.status')
      .getRawMany<{ date: string; status: AttendanceStatus; total: string }>();
    const totalActive = await this.refs.countBy({ isActive: true });

    return {
      days: Array.from({ length: days }, (_, i) => {
        const date = addDays(start, i);
        const pick = (status: AttendanceStatus) =>
          Number(rows.find((r) => r.date === date && r.status === status)?.total ?? 0);
        const onTime = pick(AttendanceStatus.PRESENT);
        const late = pick(AttendanceStatus.LATE);
        const weekday = dayjs(date, DATE_FORMAT, true).day();
        const isWeekend = weekday === 0 || weekday === 6;
        return { date, onTime, late, absent: isWeekend ? 0 : Math.max(0, totalActive - onTime - late), isWeekend };
      }),
    };
  }

  async absentees({ date: requested }: DateQueryDto) {
    const date = requested ?? (await this.today());
    const refs = await this.refs
      .createQueryBuilder('ref')
      .where('ref.isActive = 1')
      .andWhere(ABSENT_FILTER, { date })
      .orderBy('ref.fullName', 'ASC')
      .limit(500)
      .getMany();
    return refs.map((ref) => ({
      employeeId: ref.employeeId,
      employeeCode: ref.employeeCode,
      fullName: ref.fullName,
      departmentName: ref.departmentName,
      positionName: ref.positionName,
    }));
  }

  /* ---------- helpers ---------- */

  private async today(): Promise<string> {
    const { timezone } = await this.schedules.getDefault();
    return toLocalDate(this.clock.now(), timezone);
  }

  private async resolveRange(from: string | undefined, to: string | undefined, defaultDays: number) {
    const end = to ?? (await this.today());
    const start = from ?? addDays(end, -(defaultDays - 1));
    if (start > end) throw new BadRequestException('Tanggal awal tidak boleh setelah tanggal akhir');
    if (diffDays(start, end) > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari`);
    }
    return { from: start, to: end };
  }

  /** Lampirkan photo key check-in/out untuk satu halaman data (1 query tambahan, bukan N+1) */
  private async paginate(
    items: Attendance[],
    total: number,
    page: number,
    limit: number,
  ): Promise<Paginated<AttendanceRecordView>> {
    const ids = items.map((a) => a.id);
    const photoLogs = ids.length
      ? await this.logs.find({
          where: { attendanceId: In(ids) },
          select: { attendanceId: true, type: true, photoKey: true },
        })
      : [];
    return {
      items: items.map((a) =>
        toRecordView(
          a,
          photoLogs.filter((log) => log.attendanceId === a.id),
        ),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
