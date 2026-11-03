import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Replika read-only data karyawan milik employee-service, disinkronkan lewat event
 * (event-carried state transfer). Memungkinkan filter/join tanpa query lintas database.
 */
@Entity('employee_refs')
@Index('IDX_employee_refs_department', ['departmentId'])
@Index('IDX_employee_refs_active', ['isActive'])
export class EmployeeRef {
  @PrimaryColumn({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @Column({ name: 'employee_code', length: 20 })
  employeeCode!: string;

  @Column({ name: 'full_name', length: 100 })
  fullName!: string;

  @Column({ name: 'department_id', type: 'char', length: 36 })
  departmentId!: string;

  @Column({ name: 'department_name', length: 100 })
  departmentName!: string;

  @Column({ name: 'position_name', length: 100 })
  positionName!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt!: Date;
}
