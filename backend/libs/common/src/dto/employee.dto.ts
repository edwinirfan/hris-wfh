import { OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmploymentType, Gender, Role } from '../enums';
import {
  EMPLOYEE_CODE_REGEX,
  IsDateOnly,
  MaxAge,
  MinAge,
  NormalizePhone,
  NotFutureBeyond,
  PERSON_NAME_REGEX,
  PHONE_REGEX,
  ToBoolean,
  Trim,
  TrimLower,
  TrimUpper,
} from '../validation/validators';
import { PaginationQueryDto } from './pagination.dto';

export class CreateEmployeeDto {
  /** Nomor Induk Karyawan, contoh: DXA-0012 */
  @TrimUpper()
  @Matches(EMPLOYEE_CODE_REGEX, {
    message: 'NIK hanya boleh huruf besar, angka, dan strip (3–20 karakter)',
  })
  employeeCode!: string;

  @Trim()
  @IsString()
  @Length(3, 100, { message: 'Nama lengkap 3–100 karakter' })
  @Matches(PERSON_NAME_REGEX, { message: 'Nama hanya boleh berisi huruf, spasi, titik, petik, dan strip' })
  fullName!: string;

  @TrimLower()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150)
  email!: string;

  /** Format Indonesia: 08xx / 628xx / +628xx */
  @NormalizePhone()
  @Matches(PHONE_REGEX, { message: 'Nomor HP tidak valid (contoh: 081234567890)' })
  phone!: string;

  @IsEnum(Gender)
  gender!: Gender;

  /** YYYY-MM-DD */
  @IsDateOnly()
  @MinAge(17)
  @MaxAge(70)
  birthDate!: string;

  @IsUUID('all', { message: 'Departemen tidak valid' })
  departmentId!: string;

  @IsUUID('all', { message: 'Jabatan tidak valid' })
  positionId!: string;

  /** YYYY-MM-DD, maksimal 30 hari ke depan */
  @IsDateOnly()
  @NotFutureBeyond(30, { message: 'Tanggal bergabung maksimal 30 hari ke depan' })
  joinDate!: string;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  /** Role akun login (default EMPLOYEE). Dipakai gateway saat membuat user di auth-service. */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateEmployeeDto extends PartialType(OmitType(CreateEmployeeDto, ['role'] as const)) {
  /** Versi data saat form dibuka (optimistic locking) */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class SetEmployeeStatusDto {
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export const EMPLOYEE_SORT_FIELDS = ['fullName', 'employeeCode', 'joinDate', 'createdAt'] as const;
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

export class EmployeeQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(EMPLOYEE_SORT_FIELDS)
  sortBy: EmployeeSortField = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}

export class PositionQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

/* ---------- Payload internal (gateway → employee-service) ---------- */

export class CreateEmployeeRpcDto {
  @ValidateNested()
  @Type(() => CreateEmployeeDto)
  data!: CreateEmployeeDto;

  @IsUUID()
  actorId!: string;
}

export class UpdateEmployeeRpcDto {
  @IsUUID()
  id!: string;

  @ValidateNested()
  @Type(() => UpdateEmployeeDto)
  data!: UpdateEmployeeDto;

  @IsUUID()
  actorId!: string;
}

export class SetEmployeeStatusRpcDto {
  @IsUUID()
  id!: string;

  @ValidateNested()
  @Type(() => SetEmployeeStatusDto)
  data!: SetEmployeeStatusDto;

  @IsUUID()
  actorId!: string;
}

export class IdRpcDto {
  @IsUUID()
  id!: string;
}
