import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from './department.entity';

@Entity('positions')
@Index('UQ_positions_department_name', ['departmentId', 'name'], { unique: true })
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'department_id', type: 'char', length: 36 })
  departmentId!: string;

  @ManyToOne(() => Department, (department) => department.positions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id', foreignKeyConstraintName: 'FK_positions_department' })
  department?: Department;

  @Column({ length: 100 })
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
