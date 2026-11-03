import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('work_schedules')
export class WorkSchedule {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ length: 50 })
  name!: string;

  /** "08:00:00" */
  @Column({ name: 'work_start', type: 'time' })
  workStart!: string;

  @Column({ name: 'work_end', type: 'time' })
  workEnd!: string;

  @Column({ name: 'late_tolerance_minutes', type: 'smallint', unsigned: true, default: 15 })
  lateToleranceMinutes!: number;

  @Column({ length: 50, default: 'Asia/Jakarta' })
  timezone!: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
