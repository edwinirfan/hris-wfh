import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AUTH_SERVICE,
  AuthPatterns,
  AuthUserView,
  CreateEmployeeDto,
  EMPLOYEE_SERVICE,
  EmployeePatterns,
  Role,
  sendRpc,
} from '@app/common';

export interface EmployeeView {
  id: string;
  email: string;
  [key: string]: unknown;
}

@Injectable()
export class EmployeesFacade {
  private readonly logger = new Logger(EmployeesFacade.name);

  constructor(
    @Inject(EMPLOYEE_SERVICE) private readonly employeeClient: ClientProxy,
    @Inject(AUTH_SERVICE) private readonly authClient: ClientProxy,
  ) {}

  /**
   * Saga (orchestration):
   *   1. employee-service: buat data karyawan
   *   2. auth-service: buat akun login + password sementara
   *   ✗ langkah 2 gagal → kompensasi: hapus karyawan dari langkah 1
   */
  async create(dto: CreateEmployeeDto, actorEmployeeId: string) {
    const employee = await sendRpc<EmployeeView>(this.employeeClient, EmployeePatterns.CREATE, {
      data: dto,
      actorId: actorEmployeeId,
    });

    try {
      const account = await sendRpc<{ user: AuthUserView; temporaryPassword: string }>(
        this.authClient,
        AuthPatterns.CREATE_USER,
        { employeeId: employee.id, email: employee.email, role: dto.role ?? Role.EMPLOYEE },
      );
      return {
        employee,
        account: {
          email: account.user.email,
          role: account.user.role,
          temporaryPassword: account.temporaryPassword,
        },
      };
    } catch (error) {
      this.logger.warn(`Saga create-employee gagal pada langkah create-user, kompensasi karyawan ${employee.id}`);
      await sendRpc(this.employeeClient, EmployeePatterns.COMPENSATE_DELETE, { id: employee.id }).catch(
        (compensationError: unknown) =>
          this.logger.error(
            `Kompensasi gagal untuk karyawan ${employee.id} — perlu penanganan manual`,
            compensationError instanceof Error ? compensationError.stack : String(compensationError),
          ),
      );
      throw error;
    }
  }

  /** API composition: data karyawan + status akun login */
  async findDetail(id: string) {
    const [employee, account] = await Promise.all([
      sendRpc<EmployeeView>(this.employeeClient, EmployeePatterns.FIND_ONE, { id }),
      sendRpc<AuthUserView | null>(this.authClient, AuthPatterns.FIND_BY_EMPLOYEE, { employeeId: id }).catch(
        () => null,
      ),
    ]);
    return {
      ...employee,
      account: account
        ? {
            role: account.role,
            isActive: account.isActive,
            mustChangePassword: account.mustChangePassword,
            lastLoginAt: account.lastLoginAt,
            lockedUntil: account.lockedUntil,
          }
        : null,
    };
  }

  async resetPassword(id: string) {
    await sendRpc(this.employeeClient, EmployeePatterns.FIND_ONE, { id });
    return sendRpc<{ temporaryPassword: string }>(this.authClient, AuthPatterns.RESET_PASSWORD, { employeeId: id });
  }
}
