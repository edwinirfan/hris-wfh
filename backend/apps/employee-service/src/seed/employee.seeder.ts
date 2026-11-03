import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DEMO_DEPARTMENTS, DEMO_EMPLOYEES, DEMO_POSITIONS, Role } from '@app/common';
import { Department } from '../entities/department.entity';
import { Employee } from '../entities/employee.entity';
import { Position } from '../entities/position.entity';

/**
 * Master departemen/jabatan + data admin HR selalu di-seed bila kosong.
 * Karyawan demo lainnya di-seed bila SEED_DEMO_DATA=true.
 */
@Injectable()
export class EmployeeSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmployeeSeeder.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if ((await manager.count(Department)) === 0) {
        await manager.insert(
          Department,
          DEMO_DEPARTMENTS.map((d) => ({ ...d })),
        );
        await manager.insert(
          Position,
          DEMO_POSITIONS.map((p) => ({ ...p })),
        );
        this.logger.log(`Seed ${DEMO_DEPARTMENTS.length} departemen & ${DEMO_POSITIONS.length} jabatan`);
      }

      if ((await manager.count(Employee)) === 0) {
        const includeDemo = this.config.get<boolean>('SEED_DEMO_DATA');
        const seeds = DEMO_EMPLOYEES.filter((e) => includeDemo || e.role === Role.ADMIN_HR);
        await manager.insert(
          Employee,
          seeds.map(({ role: _role, password: _password, positionName: _positionName, ...employee }) => ({
            ...employee,
            version: 1,
          })),
        );
        this.logger.log(`Seed ${seeds.length} karyawan`);
      }
    });
  }
}
