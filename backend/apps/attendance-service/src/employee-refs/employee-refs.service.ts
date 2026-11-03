import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { EMPLOYEE_SERVICE, EmployeeEventPayload, EmployeePatterns, sendRpc } from '@app/common';
import { EmployeeRef } from '../entities/employee-ref.entity';

interface RemoteEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  isActive: boolean;
  department: { id: string; name: string };
  position: { name: string };
}

@Injectable()
export class EmployeeRefsService {
  private readonly logger = new Logger(EmployeeRefsService.name);

  constructor(
    @InjectRepository(EmployeeRef) private readonly refs: Repository<EmployeeRef>,
    @Inject(EMPLOYEE_SERVICE) private readonly employeeClient: ClientProxy,
  ) {}

  async upsert(payload: EmployeeEventPayload): Promise<void> {
    await this.refs.upsert(
      {
        employeeId: payload.id,
        employeeCode: payload.employeeCode,
        fullName: payload.fullName,
        departmentId: payload.departmentId,
        departmentName: payload.departmentName,
        positionName: payload.positionName,
        isActive: payload.isActive,
      },
      ['employeeId'],
    );
  }

  async setActive(employeeId: string, isActive: boolean): Promise<void> {
    await this.refs.update({ employeeId }, { isActive });
  }

  /** Karyawan yang sudah punya absensi tidak dihapus (FK RESTRICT) — cukup dinonaktifkan */
  async remove(employeeId: string): Promise<void> {
    try {
      await this.refs.delete({ employeeId });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        await this.setActive(employeeId, false);
        return;
      }
      throw error;
    }
  }

  /**
   * Ambil replika karyawan. Bila belum tersinkron (mis. event hilang saat RabbitMQ down),
   * tarik langsung dari employee-service via TCP lalu simpan — self-healing.
   */
  async ensure(employeeId: string): Promise<EmployeeRef> {
    const ref = await this.refs.findOneBy({ employeeId });
    if (ref) return ref;

    this.logger.warn(`employee_refs ${employeeId} belum ada, sinkronisasi on-demand ke employee-service`);
    const employee = await sendRpc<RemoteEmployee>(this.employeeClient, EmployeePatterns.FIND_ONE, { id: employeeId });
    await this.upsert({
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      departmentId: employee.department.id,
      departmentName: employee.department.name,
      positionName: employee.position.name,
      isActive: employee.isActive,
    });
    return this.refs.findOneByOrFail({ employeeId });
  }

  countActive(): Promise<number> {
    return this.refs.countBy({ isActive: true });
  }
}
