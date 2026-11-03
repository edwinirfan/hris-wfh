import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { EmploymentType, Gender } from '@app/common';
import { Department } from './department.entity';
import { Position } from './position.entity';

@Entity('employees')
@Index('UQ_employees_employee_code', ['employeeCode'], { unique: true })
@Index('UQ_employees_email', ['email'], { unique: true })
@Index('IDX_employees_department', ['departmentId'])
@Index('IDX_employees_full_name', ['fullName'])
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_code', length: 20 })
  employeeCode!: string;

  @Column({ name: 'full_name', length: 100 })
  fullName!: string;

  @Column({ length: 150 })
  email!: string;

  @Column({ length: 20 })
  phone!: string;

  @Column({ type: 'enum', enum: Gender })
  gender!: Gender;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate!: string;

  @Column({ name: 'department_id', type: 'char', length: 36 })
  departmentId!: string;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id', foreignKeyConstraintName: 'FK_employees_department' })
  department?: Department;

  @Column({ name: 'position_id', type: 'char', length: 36 })
  positionId!: string;

  @ManyToOne(() => Position, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id', foreignKeyConstraintName: 'FK_employees_position' })
  position?: Position;

  @Column({ name: 'join_date', type: 'date' })
  joinDate!: string;

  @Column({ name: 'employment_type', type: 'enum', enum: EmploymentType })
  employmentType!: EmploymentType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'profile_photo_key', type: 'varchar', length: 255, nullable: true })
  profilePhotoKey!: string | null;

  /** employee_id milik HR yang membuat/mengubah data */
  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;

  /** Optimistic locking: bertambah otomatis setiap update */
  @VersionColumn()
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
