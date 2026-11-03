import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  CreateEmployeeRpcDto,
  EventPublisher,
  EmployeeEventPayload,
  EmployeeQueryDto,
  Events,
  isDuplicateOn,
  Paginated,
  SetEmployeeStatusRpcDto,
  UpdateEmployeeRpcDto,
} from '@app/common';
import { Department } from '../entities/department.entity';
import { Employee } from '../entities/employee.entity';
import { Position } from '../entities/position.entity';

import { EmployeeView, toEmployeeView } from './employee.view';

const SORT_COLUMNS: Record<EmployeeQueryDto['sortBy'], string> = {
  fullName: 'employee.fullName',
  employeeCode: 'employee.employeeCode',
  joinDate: 'employee.joinDate',
  createdAt: 'employee.createdAt',
};

/** Kompensasi saga hanya boleh menghapus data yang benar-benar baru dibuat */
const COMPENSATION_WINDOW_MS = 5 * 60_000;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** DTO class punya properti own bernilai undefined (useDefineForClassFields) — jangan ikut di-UPDATE */
const definedOnly = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(Department) private readonly departments: Repository<Department>,
    @InjectRepository(Position) private readonly positions: Repository<Position>,
    private readonly events: EventPublisher,
  ) {}

  async create({ data, actorId }: CreateEmployeeRpcDto): Promise<EmployeeView> {
    await this.assertPositionInDepartment(data.positionId, data.departmentId);
    await this.assertUnique({ employeeCode: data.employeeCode, email: data.email });

    const { role: _role, ...fields } = data;
    let saved: Employee;
    try {
      saved = await this.employees.save(
        this.employees.create({ ...fields, isActive: true, createdBy: actorId, updatedBy: actorId }),
      );
    } catch (error) {
      throw this.mapDuplicate(error);
    }

    const employee = await this.findEntity(saved.id);
    await this.events.publish(Events.EMPLOYEE_CREATED, this.toEventPayload(employee));
    return toEmployeeView(employee);
  }

  async findAll(query: EmployeeQueryDto): Promise<Paginated<EmployeeView>> {
    const qb = this.employees
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.position', 'position');

    if (query.search) {
      const term = `%${escapeLike(query.search)}%`;
      qb.andWhere(
        new Brackets((where) =>
          where
            .where('employee.fullName LIKE :term', { term })
            .orWhere('employee.employeeCode LIKE :term', { term })
            .orWhere('employee.email LIKE :term', { term }),
        ),
      );
    }
    if (query.departmentId) qb.andWhere('employee.departmentId = :departmentId', { departmentId: query.departmentId });
    if (query.isActive !== undefined) qb.andWhere('employee.isActive = :isActive', { isActive: query.isActive });

    const [items, total] = await qb
      .orderBy(SORT_COLUMNS[query.sortBy], query.sortOrder)
      .addOrderBy('employee.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: items.map(toEmployeeView),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findOne(id: string): Promise<EmployeeView> {
    return toEmployeeView(await this.findEntity(id));
  }

  async update({ id, data, actorId }: UpdateEmployeeRpcDto): Promise<EmployeeView> {
    const current = await this.findEntity(id);
    const { version, ...changes } = data;

    if (version !== current.version) throw this.staleVersion();

    const departmentId = changes.departmentId ?? current.departmentId;
    const positionId = changes.positionId ?? current.positionId;
    if (changes.departmentId || changes.positionId) {
      await this.assertPositionInDepartment(positionId, departmentId);
    }
    await this.assertUnique(
      {
        employeeCode: changes.employeeCode !== current.employeeCode ? changes.employeeCode : undefined,
        email: changes.email !== current.email ? changes.email : undefined,
      },
      id,
    );

    // UPDATE ... WHERE id = ? AND version = ? → aman dari dua HR yang menyimpan bersamaan
    try {
      const result = await this.employees
        .createQueryBuilder()
        .update(Employee)
        .set({ ...definedOnly(changes), updatedBy: actorId })
        .where('id = :id AND version = :version', { id, version })
        .execute();
      if (result.affected === 0) throw this.staleVersion();
    } catch (error) {
      throw this.mapDuplicate(error);
    }

    const employee = await this.findEntity(id);
    await this.events.publish(Events.EMPLOYEE_UPDATED, this.toEventPayload(employee));
    return toEmployeeView(employee);
  }

  async setStatus({ id, data, actorId }: SetEmployeeStatusRpcDto): Promise<EmployeeView> {
    const employee = await this.findEntity(id);
    if (!data.isActive && id === actorId) {
      throw new BadRequestException('Anda tidak dapat menonaktifkan akun Anda sendiri');
    }
    if (employee.isActive === data.isActive) return toEmployeeView(employee);

    await this.employees.update(id, { isActive: data.isActive, updatedBy: actorId });
    const updated = await this.findEntity(id);
    await this.events.publish(Events.EMPLOYEE_STATUS_CHANGED, { id, isActive: data.isActive });
    await this.events.publish(Events.EMPLOYEE_UPDATED, this.toEventPayload(updated));
    return toEmployeeView(updated);
  }

  /** Langkah kompensasi saga: dipanggil gateway bila pembuatan akun login gagal */
  async compensateDelete(id: string): Promise<{ deleted: boolean }> {
    const employee = await this.employees.findOneBy({ id });
    if (!employee) return { deleted: false };
    if (Date.now() - employee.createdAt.getTime() > COMPENSATION_WINDOW_MS) {
      throw new ConflictException('Data karyawan lama tidak dapat dihapus melalui kompensasi');
    }
    await this.employees.delete(id);
    await this.events.publish(Events.EMPLOYEE_DELETED, { id });
    return { deleted: true };
  }

  async findDepartments() {
    const departments = await this.departments.find({ order: { name: 'ASC' } });
    return departments.map(({ id, code, name }) => ({ id, code, name }));
  }

  async findPositions(departmentId?: string) {
    const positions = await this.positions.find({
      where: departmentId ? { departmentId } : {},
      order: { name: 'ASC' },
    });
    return positions.map(({ id, name, departmentId: deptId }) => ({ id, name, departmentId: deptId }));
  }

  /* ---------- helpers ---------- */

  private async findEntity(id: string): Promise<Employee> {
    const employee = await this.employees.findOne({
      where: { id },
      relations: { department: true, position: true },
    });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan');
    return employee;
  }

  private async assertPositionInDepartment(positionId: string, departmentId: string): Promise<void> {
    const position = await this.positions.findOneBy({ id: positionId });
    if (!position) throw new BadRequestException('Jabatan tidak ditemukan');
    if (!(await this.departments.existsBy({ id: departmentId }))) {
      throw new BadRequestException('Departemen tidak ditemukan');
    }
    if (position.departmentId !== departmentId) {
      throw new BadRequestException('Jabatan tidak termasuk dalam departemen yang dipilih');
    }
  }

  private async assertUnique(fields: { employeeCode?: string; email?: string }, excludeId?: string): Promise<void> {
    const conflicts: string[] = [];
    for (const [field, label] of [
      ['employeeCode', 'NIK'],
      ['email', 'Email'],
    ] as const) {
      const value = fields[field];
      if (!value) continue;
      const existing = await this.employees.findOne({ where: { [field]: value }, select: { id: true } });
      if (existing && existing.id !== excludeId) conflicts.push(`${label} ${value} sudah digunakan`);
    }
    if (conflicts.length) throw new ConflictException(conflicts.join('; '));
  }

  private mapDuplicate(error: unknown): unknown {
    if (isDuplicateOn(error, 'UQ_employees_employee_code')) return new ConflictException('NIK sudah digunakan');
    if (isDuplicateOn(error, 'UQ_employees_email')) return new ConflictException('Email sudah digunakan');
    return error;
  }

  private staleVersion(): ConflictException {
    return new ConflictException('Data karyawan telah diubah oleh pengguna lain. Muat ulang data lalu coba lagi.');
  }

  private toEventPayload(employee: Employee): EmployeeEventPayload {
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? '',
      positionName: employee.position?.name ?? '',
      isActive: employee.isActive,
    };
  }
}
