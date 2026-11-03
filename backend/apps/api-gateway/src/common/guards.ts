import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { JwtPayload, Role } from '@app/common';
import { ALLOW_PENDING_PASSWORD_KEY, IS_PUBLIC_KEY, ROLES_KEY } from './decorators';

export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

/*
 * Gateway adalah hybrid app (HTTP + consumer RabbitMQ + WebSocket). Guard global juga
 * dipanggil untuk konteks non-HTTP, jadi semua guard di sini hanya aktif untuk HTTP.
 */

export function extractBearer(header?: string): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  override canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return Promise.resolve(true);
    return super.canActivate(context);
  }
}

/** Verifikasi access token secara lokal (tanpa RPC ke auth-service) */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const token = extractBearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Token akses tidak ditemukan');

    try {
      request.user = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token akses tidak valid atau sudah kedaluwarsa');
    }

    if (request.user.mcp && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, targets)) {
      throw new ForbiddenException(PASSWORD_CHANGE_REQUIRED);
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: JwtPayload }>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Anda tidak memiliki akses ke fitur ini');
    }
    return true;
  }
}
