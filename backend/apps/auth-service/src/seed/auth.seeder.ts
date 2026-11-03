import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { DEMO_EMPLOYEES, Role } from '@app/common';
import { User } from '../entities/user.entity';

/**
 * Akun admin HR selalu dibuat bila tabel users kosong (tanpa admin aplikasi tidak bisa dipakai).
 * Akun karyawan demo dibuat bila SEED_DEMO_DATA=true.
 */
@Injectable()
export class AuthSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthSeeder.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.users.count()) > 0) return;

    const includeDemo = this.config.get<boolean>('SEED_DEMO_DATA');
    const rounds = this.config.getOrThrow<number>('BCRYPT_ROUNDS');
    const seeds = DEMO_EMPLOYEES.filter((e) => includeDemo || e.role === Role.ADMIN_HR);

    for (const seed of seeds) {
      await this.users.save(
        this.users.create({
          employeeId: seed.id,
          email: seed.email,
          role: seed.role,
          isActive: seed.isActive,
          mustChangePassword: false,
          passwordHash: await bcrypt.hash(seed.password, rounds),
        }),
      );
    }
    this.logger.log(`Seed ${seeds.length} akun login`);
  }
}
