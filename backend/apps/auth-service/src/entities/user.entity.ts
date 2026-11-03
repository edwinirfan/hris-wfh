import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '@app/common';
import { RefreshToken } from './refresh-token.entity';

@Entity('users')
@Index('UQ_users_employee_id', ['employeeId'], { unique: true })
@Index('UQ_users_email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Referensi logis ke employee_db.employees (lintas service → tanpa FK fisik) */
  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @Column({ length: 150 })
  email!: string;

  @Column({ name: 'password_hash', length: 100, select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role, default: Role.EMPLOYEE })
  role!: Role;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ name: 'failed_login_count', type: 'smallint', unsigned: true, default: 0 })
  failedLoginCount!: number;

  @Column({ name: 'locked_until', type: 'datetime', precision: 3, nullable: true })
  lockedUntil!: Date | null;

  @Column({ name: 'last_login_at', type: 'datetime', precision: 3, nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'password_changed_at', type: 'datetime', precision: 3, nullable: true })
  passwordChangedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens?: RefreshToken[];
}
