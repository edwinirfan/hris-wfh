import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AuthUserView, JwtPayload, TokenPairResponse } from '@app/common';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { sha256 } from './password.util';

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

type RotationResult =
  { pair: TokenPairResponse } | { error: 'invalid' | 'expired' | 'inactive' } | { error: 'reused'; userId: string };

const ROTATION_ERRORS = {
  invalid: 'Sesi tidak valid, silakan login ulang',
  reused: 'Sesi tidak valid, silakan login ulang',
  expired: 'Sesi telah berakhir, silakan login ulang',
  inactive: 'Akun tidak aktif',
} as const;

export function toUserView(user: User): AuthUserView {
  return {
    id: user.id,
    employeeId: user.employeeId,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    lockedUntil: user.lockedUntil,
  };
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = config.getOrThrow<number>('JWT_ACCESS_TTL');
    this.refreshTtlDays = config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
  }

  async issue(
    user: User,
    client: ClientInfo,
    manager?: EntityManager,
  ): Promise<{ pair: TokenPairResponse; tokenId: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      mcp: user.mustChangePassword,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.accessTtlSeconds });
    const refreshToken = randomBytes(48).toString('base64url');

    const repo = manager ? manager.getRepository(RefreshToken) : this.refreshTokens;
    const saved = await repo.save(
      repo.create({
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlDays * 86_400_000),
        ipAddress: client.ip ?? null,
        userAgent: client.userAgent?.slice(0, 255) ?? null,
      }),
    );

    return {
      pair: { accessToken, refreshToken, expiresIn: this.accessTtlSeconds, user: toUserView(user) },
      tokenId: saved.id,
    };
  }

  /**
   * Refresh token rotation: token lama dicabut dan diganti token baru.
   * Jika token yang SUDAH dicabut dipakai lagi (indikasi dicuri), semua sesi user dicabut.
   */
  async rotate(refreshToken: string, client: ClientInfo): Promise<TokenPairResponse> {
    const tokenHash = sha256(refreshToken);
    const result = await this.dataSource.transaction<RotationResult>(async (manager) => {
      const token = await manager.findOne(RefreshToken, {
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!token) return { error: 'invalid' };
      if (token.revokedAt) return { error: 'reused', userId: token.userId };
      if (token.expiresAt.getTime() <= Date.now()) return { error: 'expired' };

      const user = await manager.findOneBy(User, { id: token.userId });
      if (!user || !user.isActive) return { error: 'inactive' };

      const issued = await this.issue(user, client, manager);
      await manager.update(RefreshToken, token.id, { revokedAt: new Date(), replacedById: issued.tokenId });
      return { pair: issued.pair };
    });

    if ('pair' in result) return result.pair;
    if (result.error === 'reused') {
      this.logger.warn(`Refresh token reuse terdeteksi untuk user ${result.userId}, semua sesi dicabut`);
      await this.revokeAllForUser(result.userId);
    }
    throw new UnauthorizedException(ROTATION_ERRORS[result.error]);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.refreshTokens.update(
      { tokenHash: sha256(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(RefreshToken) : this.refreshTokens;
    await repo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
