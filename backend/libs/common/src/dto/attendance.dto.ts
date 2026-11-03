import { Type } from 'class-transformer';
import {
  Equals,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus, AttendanceType, Role } from '../enums';
import { IsDateOnly, RequiredWith, ToBoolean, Trim } from '../validation/validators';
import { PaginationQueryDto } from './pagination.dto';

/**
 * Field multipart yang dikirim bersama foto saat check-in/check-out.
 * Metadata wajah berasal dari MediaPipe di browser — server tetap memvalidasi
 * dan menyimpannya sebagai jejak audit.
 */
export class AttendanceCaptureDto {
  @Type(() => Number)
  @IsInt()
  @Equals(1, { message: 'Foto harus berisi tepat satu wajah' })
  faceCount!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.5, { message: 'Keyakinan deteksi wajah terlalu rendah' })
  @Max(1)
  faceConfidence!: number;

  @ToBoolean()
  @Equals(true, { message: 'Verifikasi liveness (kedip) wajib dilakukan' })
  livenessPassed!: boolean;

  /** Jam perangkat saat foto diambil — hanya untuk audit selisih jam */
  @IsOptional()
  @IsISO8601({ strict: true })
  clientTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  @RequiredWith('longitude')
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  @RequiredWith('latitude')
  longitude?: number;

  /** Akurasi lokasi (meter) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  accuracy?: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class AttendanceHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;
}

export class AttendanceQueryDto extends AttendanceHistoryQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['attendanceDate', 'checkInAt', 'fullName'])
  sortBy: 'attendanceDate' | 'checkInAt' | 'fullName' = 'checkInAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}

export class DateQueryDto {
  @IsOptional()
  @IsDateOnly()
  date?: string;
}

export class StatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days: number = 7;
}

/* ---------- Payload internal (gateway → attendance-service) ---------- */

export class PrecheckRpcDto {
  @IsUUID()
  employeeId!: string;

  @IsEnum(AttendanceType)
  type!: AttendanceType;
}

export class StoredPhotoDto {
  @IsString()
  @MaxLength(255)
  key!: string;

  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]{64}$/)
  sha256!: string;

  @IsInt()
  @Min(1)
  size!: number;

  @IsInt()
  @Min(1)
  width!: number;

  @IsInt()
  @Min(1)
  height!: number;

  @IsString()
  @MaxLength(30)
  mime!: string;
}

export class RecordAttendanceRpcDto {
  @IsUUID()
  employeeId!: string;

  @ValidateNested()
  @Type(() => StoredPhotoDto)
  photo!: StoredPhotoDto;

  @ValidateNested()
  @Type(() => AttendanceCaptureDto)
  capture!: AttendanceCaptureDto;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  ip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;
}

export class MyHistoryRpcDto {
  @IsUUID()
  employeeId!: string;

  @ValidateNested()
  @Type(() => AttendanceHistoryQueryDto)
  query!: AttendanceHistoryQueryDto;
}

export class FindAttendanceRpcDto {
  @IsUUID()
  id!: string;

  /** Diisi bila yang meminta bukan ADMIN_HR → service memastikan kepemilikan data */
  @IsOptional()
  @IsUUID()
  requesterEmployeeId?: string;

  @IsEnum(Role)
  requesterRole!: Role;
}
