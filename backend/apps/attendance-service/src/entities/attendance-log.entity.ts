import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AttendanceType, decimalTransformer } from '@app/common';
import { Attendance } from './attendance.entity';

/** Detail tiap aksi absensi (check-in / check-out) beserta bukti foto & metadata verifikasi */
@Entity('attendance_logs')
@Index('UQ_attendance_logs_attendance_type', ['attendanceId', 'type'], { unique: true })
@Index('UQ_attendance_logs_photo_sha256', ['photoSha256'], { unique: true })
export class AttendanceLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'attendance_id', type: 'char', length: 36 })
  attendanceId!: string;

  @ManyToOne(() => Attendance, (attendance) => attendance.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_id', foreignKeyConstraintName: 'FK_attendance_logs_attendance' })
  attendance?: Attendance;

  @Column({ type: 'enum', enum: AttendanceType })
  type!: AttendanceType;

  /** Jam server — sumber kebenaran */
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;

  /** Jam perangkat karyawan (audit) */
  @Column({ name: 'client_time', type: 'datetime', precision: 3, nullable: true })
  clientTime!: Date | null;

  /** clientTime - recordedAt (detik); positif = jam perangkat lebih cepat */
  @Column({ name: 'clock_drift_seconds', type: 'int', nullable: true })
  clockDriftSeconds!: number | null;

  @Column({ name: 'photo_key', length: 255 })
  photoKey!: string;

  @Column({ name: 'photo_sha256', type: 'char', length: 64 })
  photoSha256!: string;

  @Column({ name: 'photo_size', type: 'int', unsigned: true })
  photoSize!: number;

  @Column({ name: 'photo_width', type: 'smallint', unsigned: true })
  photoWidth!: number;

  @Column({ name: 'photo_height', type: 'smallint', unsigned: true })
  photoHeight!: number;

  @Column({ name: 'photo_mime', length: 30 })
  photoMime!: string;

  @Column({ name: 'face_count', type: 'tinyint', unsigned: true })
  faceCount!: number;

  @Column({ name: 'face_confidence', type: 'decimal', precision: 5, scale: 4, transformer: decimalTransformer })
  faceConfidence!: number;

  @Column({ name: 'liveness_passed', type: 'boolean' })
  livenessPassed!: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true, transformer: decimalTransformer })
  latitude!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true, transformer: decimalTransformer })
  longitude!: number | null;

  @Column({
    name: 'location_accuracy_m',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  locationAccuracyM!: number | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
