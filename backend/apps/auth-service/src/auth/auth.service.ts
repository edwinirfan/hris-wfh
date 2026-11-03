import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import {
  APP_TIMEZONE,
  AuthUserView,
  ChangePasswordRpcDto,
  CreateUserRpcDto,
  dayjs,
  EmployeeEventPayload,
  isDuplicateOn,
  LoginRpcDto,
  TokenPairResponse,
} from '@app/common';
import { User } from '../entities/user.entity';
import { generateTemporaryPassword } from './password.util';
import { ClientInfo, TokenService, toUserView } from './token.service';

const INVALID_CREDENTIALS = 'Email atau password salah';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedAttempts: number;
  private readonly lockMinutes: number;
  private readonly bcryptRounds: number;
  /** Hash dummy agar waktu respons login sama walau email tidak terdaftar (anti user-enumeration) */
  private readonly dummyHash: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly tokens: TokenService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.maxFailedAttempts = config.getOrThrow<number>('LOGIN_MAX_ATTEMPTS');
    this.lockMinutes = config.getOrThrow<number>('LOGIN_LOCK_MINUTES');
    this.bcryptRounds = config.getOrThrow<number>('BCRYPT_ROUNDS');
    this.dummyHash = bcrypt.hashSync(randomBytes(16).toString('hex'), this.bcryptRounds);
  }

  async login(dto: LoginRpcDto): Promise<TokenPairResponse> {
    const user = await this.findWithPassword({ email: dto.email });
    if (!user) {
      await bcrypt.compare(dto.password, this.dummyHash);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw this.lockedException(user.lockedUntil);
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.registerFailedAttempt(user.id);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Status aktif dicek SETELAH password benar supaya tidak membocorkan keberadaan akun
    if (!user.isActive) {
      throw new ForbiddenException('Akun Anda nonaktif. Silakan hubungi HRD.');
    }

    const now = new Date();
    await this.users.update(user.id, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now });
    Object.assign(user, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now });

    return (await this.tokens.issue(user, this.clientInfo(dto))).pair;
  }

  refresh(refreshToken: string, client: ClientInfo): Promise<TokenPairResponse> {
    return this.tokens.rotate(refreshToken, client);
  }

  async logout(refreshToken: string): Promise<null> {
    await this.tokens.revoke(refreshToken);
    return null;
  }

  async changePassword(dto: ChangePasswordRpcDto): Promise<TokenPairResponse> {
    const user = await this.findWithPassword({ id: dto.userId });
    if (!user || !user.isActive) throw new UnauthorizedException('Akun tidak ditemukan atau nonaktif');

    // 400 (bukan 401) supaya frontend tidak menganggap sesi kedaluwarsa
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Password lama tidak sesuai');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Password baru tidak boleh sama dengan password lama');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);
    return this.dataSource.transaction(async (manager) => {
      await manager.update(User, user.id, {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      });
      await this.tokens.revokeAllForUser(user.id, manager);
      user.mustChangePassword = false;
      return (await this.tokens.issue(user, this.clientInfo(dto), manager)).pair;
    });
  }

  async me(userId: string): Promise<AuthUserView> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Akun tidak ditemukan');
    return toUserView(user);
  }

  async findByEmployee(employeeId: string): Promise<AuthUserView | null> {
    const user = await this.users.findOneBy({ employeeId });
    return user ? toUserView(user) : null;
  }

  /** Dipanggil saga "create employee" di gateway */
  async createUser(dto: CreateUserRpcDto): Promise<{ user: AuthUserView; temporaryPassword: string }> {
    if (await this.users.existsBy({ email: dto.email })) {
      throw new ConflictException('Email sudah terdaftar sebagai akun login');
    }
    if (await this.users.existsBy({ employeeId: dto.employeeId })) {
      throw new ConflictException('Karyawan ini sudah memiliki akun login');
    }

    const temporaryPassword = generateTemporaryPassword();
    try {
      const user = await this.users.save(
        this.users.create({
          employeeId: dto.employeeId,
          email: dto.email,
          role: dto.role,
          passwordHash: await bcrypt.hash(temporaryPassword, this.bcryptRounds),
          mustChangePassword: true,
          isActive: true,
        }),
      );
      return { user: toUserView(user), temporaryPassword };
    } catch (error) {
      if (isDuplicateOn(error, 'UQ_users_email'))
        throw new ConflictException('Email sudah terdaftar sebagai akun login');
      if (isDuplicateOn(error, 'UQ_users_employee_id'))
        throw new ConflictException('Karyawan ini sudah memiliki akun login');
      throw error;
    }
  }

  async resetPassword(employeeId: string): Promise<{ temporaryPassword: string }> {
    const user = await this.users.findOneBy({ employeeId });
    if (!user) throw new NotFoundException('Akun login karyawan tidak ditemukan');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, this.bcryptRounds);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, user.id, {
        passwordHash,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      });
      await this.tokens.revokeAllForUser(user.id, manager);
    });
    return { temporaryPassword };
  }

  /* ---------- Sinkronisasi dari event employee-service ---------- */

  async syncEmployee(payload: EmployeeEventPayload): Promise<void> {
    const user = await this.users.findOneBy({ employeeId: payload.id });
    if (!user || user.email === payload.email) return;
    await this.users.update(user.id, { email: payload.email });
    this.logger.log(`Email akun ${user.id} disinkronkan dari employee-service`);
  }

  async syncStatus(employeeId: string, isActive: boolean): Promise<void> {
    const user = await this.users.findOneBy({ employeeId });
    if (!user) return;
    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, user.id, { isActive });
      if (!isActive) await this.tokens.revokeAllForUser(user.id, manager);
    });
  }

  async removeByEmployee(employeeId: string): Promise<void> {
    await this.users.delete({ employeeId });
  }

  /* ---------- helpers ---------- */

  private findWithPassword(where: { email?: string; id?: string }): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where(where.email ? 'user.email = :email' : 'user.id = :id', where)
      .getOne();
  }

  private async registerFailedAttempt(userId: string): Promise<void> {
    await this.users.increment({ id: userId }, 'failedLoginCount', 1);
    const { failedLoginCount } = await this.users.findOneByOrFail({ id: userId });
    if (failedLoginCount >= this.maxFailedAttempts) {
      const lockedUntil = new Date(Date.now() + this.lockMinutes * 60_000);
      await this.users.update(userId, { failedLoginCount: 0, lockedUntil });
      throw this.lockedException(lockedUntil);
    }
  }

  private lockedException(until: Date): HttpException {
    const time = dayjs(until).tz(APP_TIMEZONE).format('HH:mm');
    return new HttpException(
      `Terlalu banyak percobaan login gagal. Akun terkunci sampai pukul ${time} WIB`,
      HttpStatus.LOCKED,
    );
  }

  private clientInfo(dto: { ip?: string; userAgent?: string }): ClientInfo {
    return { ip: dto.ip, userAgent: dto.userAgent };
  }
}
