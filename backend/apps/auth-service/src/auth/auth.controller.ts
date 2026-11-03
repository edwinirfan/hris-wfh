import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import {
  AuthPatterns,
  ChangePasswordRpcDto,
  CreateUserRpcDto,
  EmployeeIdRpcDto,
  LoginRpcDto,
  RefreshRpcDto,
  RefreshTokenDto,
  UserIdRpcDto,
} from '@app/common';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(AuthPatterns.LOGIN, Transport.TCP)
  login(@Payload() dto: LoginRpcDto) {
    return this.auth.login(dto);
  }

  @MessagePattern(AuthPatterns.REFRESH, Transport.TCP)
  refresh(@Payload() dto: RefreshRpcDto) {
    return this.auth.refresh(dto.refreshToken, { ip: dto.ip, userAgent: dto.userAgent });
  }

  @MessagePattern(AuthPatterns.LOGOUT, Transport.TCP)
  logout(@Payload() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @MessagePattern(AuthPatterns.CHANGE_PASSWORD, Transport.TCP)
  changePassword(@Payload() dto: ChangePasswordRpcDto) {
    return this.auth.changePassword(dto);
  }

  @MessagePattern(AuthPatterns.ME, Transport.TCP)
  me(@Payload() dto: UserIdRpcDto) {
    return this.auth.me(dto.userId);
  }

  @MessagePattern(AuthPatterns.CREATE_USER, Transport.TCP)
  createUser(@Payload() dto: CreateUserRpcDto) {
    return this.auth.createUser(dto);
  }

  @MessagePattern(AuthPatterns.RESET_PASSWORD, Transport.TCP)
  resetPassword(@Payload() dto: EmployeeIdRpcDto) {
    return this.auth.resetPassword(dto.employeeId);
  }

  @MessagePattern(AuthPatterns.FIND_BY_EMPLOYEE, Transport.TCP)
  findByEmployee(@Payload() dto: EmployeeIdRpcDto) {
    return this.auth.findByEmployee(dto.employeeId);
  }
}
