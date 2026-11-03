import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Role } from '../enums';
import { PASSWORD_MESSAGE, PASSWORD_REGEX, TrimLower } from '../validation/validators';

export class LoginDto {
  @TrimLower()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password wajib diisi' })
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Password lama wajib diisi' })
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

/* ---------- Payload internal (gateway → auth-service) ---------- */

export class LoginRpcDto extends LoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;
}

export class RefreshRpcDto extends RefreshTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;
}

export class ChangePasswordRpcDto extends ChangePasswordDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  ip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;
}

export class CreateUserRpcDto {
  @IsUUID()
  employeeId!: string;

  @TrimLower()
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsEnum(Role)
  role!: Role;
}

export class UserIdRpcDto {
  @IsUUID()
  userId!: string;
}

export class EmployeeIdRpcDto {
  @IsUUID()
  employeeId!: string;
}
