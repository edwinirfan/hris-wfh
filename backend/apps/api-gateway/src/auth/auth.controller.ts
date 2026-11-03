import { Body, Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUserView, JwtPayload, TokenPairResponse } from '@app/common';
import {
  AUTH_SERVICE,
  AuthPatterns,
  ChangePasswordDto,
  EMPLOYEE_SERVICE,
  EmployeePatterns,
  LoginDto,
  RefreshTokenDto,
  sendRpc,
} from '@app/common';
import { clientInfo } from '../common/client-info';
import { AllowPendingPasswordChange, CurrentUser, Public, ResponseMessage } from '../common/decorators';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authClient: ClientProxy,
    @Inject(EMPLOYEE_SERVICE) private readonly employeeClient: ClientProxy,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ResponseMessage('Login berhasil')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return sendRpc<TokenPairResponse>(this.authClient, AuthPatterns.LOGIN, { ...dto, ...clientInfo(request) });
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return sendRpc<TokenPairResponse>(this.authClient, AuthPatterns.REFRESH, { ...dto, ...clientInfo(request) });
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ResponseMessage('Logout berhasil')
  logout(@Body() dto: RefreshTokenDto) {
    return sendRpc<null>(this.authClient, AuthPatterns.LOGOUT, { refreshToken: dto.refreshToken });
  }

  @ApiBearerAuth()
  @AllowPendingPasswordChange()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(200)
  @ResponseMessage('Password berhasil diubah')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto, @Req() request: Request) {
    return sendRpc<TokenPairResponse>(this.authClient, AuthPatterns.CHANGE_PASSWORD, {
      ...dto,
      userId: user.sub,
      ...clientInfo(request),
    });
  }

  /** API composition: akun (auth-service) + profil karyawan (employee-service) */
  @ApiBearerAuth()
  @AllowPendingPasswordChange()
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const [account, employee] = await Promise.all([
      sendRpc<AuthUserView>(this.authClient, AuthPatterns.ME, { userId: user.sub }),
      sendRpc<unknown>(this.employeeClient, EmployeePatterns.FIND_ONE, { id: user.employeeId }).catch(() => null),
    ]);
    return { user: account, employee };
  }
}
