import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Position } from './position.entity';

@Entity('departments')
@Index('UQ_departments_code', ['code'], { unique: true })
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 10 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @OneToMany(() => Position, (position) => position.department)
  positions?: Position[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
