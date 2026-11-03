import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AttendanceStatus } from '@app/common';
import { AttendanceLog } from './attendance-log.entity';
import { EmployeeRef } from './employee-ref.entity';

/** Header absensi: satu baris per karyawan per hari (tanggal lokal Asia/Jakarta) */
@Entity('attendances')
@Index('UQ_attendances_employee_date', ['employeeId', 'attendanceDate'], { unique: true })
@Index('IDX_attendances_date_status', ['attendanceDate', 'status'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @ManyToOne(() => EmployeeRef, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id', foreignKeyConstraintName: 'FK_attendances_employee_ref' })
  employee?: EmployeeRef;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate!: string;

  @Column({ name: 'check_in_at', type: 'datetime', precision: 3 })
  checkInAt!: Date;

  @Column({ name: 'check_out_at', type: 'datetime', precision: 3, nullable: true })
  checkOutAt!: Date | null;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status!: AttendanceStatus;

  @Column({ name: 'late_minutes', type: 'smallint', unsigned: true, default: 0 })
  lateMinutes!: number;

  @Column({ name: 'work_minutes', type: 'smallint', unsigned: true, nullable: true })
  workMinutes!: number | null;

  @OneToMany(() => AttendanceLog, (log) => log.attendance)
  logs?: AttendanceLog[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
