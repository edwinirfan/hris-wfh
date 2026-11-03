import { ForbiddenException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@app/common';
import { User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { generateTemporaryPassword } from './password.util';

const PASSWORD = 'Rahasia@123';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    employeeId: 'e1',
    email: 'budi@hris.local',
    passwordHash: bcrypt.hashSync(PASSWORD, 4),
    role: Role.EMPLOYEE,
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(user: User | null) {
  let failedCount = user?.failedLoginCount ?? 0;
  const users = {
    createQueryBuilder: () => ({
      addSelect: () => ({ where: () => ({ getOne: () => Promise.resolve(user) }) }),
    }),
    update: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockImplementation(() => {
      failedCount += 1;
      return Promise.resolve();
    }),
    findOneByOrFail: jest.fn().mockImplementation(() => Promise.resolve({ failedLoginCount: failedCount })),
  };
  const tokens = {
    issue: jest.fn().mockResolvedValue({ pair: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 } }),
  };
  const config = {
    getOrThrow: (key: string) => ({ LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15, BCRYPT_ROUNDS: 4 })[key],
  };
  const service = new AuthService(users as never, tokens as never, {} as never, config as never);
  return { service, users, tokens };
}

const login = (password = PASSWORD) => ({ email: 'budi@hris.local', password });

describe('AuthService.login', () => {
  it('email tidak terdaftar → 401 dengan pesan generik', async () => {
    const { service } = setup(null);
    await expect(service.login(login())).rejects.toThrow(new UnauthorizedException('Email atau password salah'));
  });

  it('password benar → token diterbitkan & counter gagal direset', async () => {
    const { service, users, tokens } = setup(makeUser({ failedLoginCount: 3 }));
    await service.login(login());
    expect(users.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
    );
    expect(tokens.issue).toHaveBeenCalled();
  });

  it('password salah → 401 dan counter bertambah', async () => {
    const { service, users } = setup(makeUser());
    await expect(service.login(login('Salah@123'))).rejects.toThrow(UnauthorizedException);
    expect(users.increment).toHaveBeenCalledWith({ id: 'u1' }, 'failedLoginCount', 1);
  });

  it('percobaan gagal ke-5 → akun dikunci (423)', async () => {
    const { service, users } = setup(makeUser({ failedLoginCount: 4 }));
    await expect(service.login(login('Salah@123'))).rejects.toMatchObject({ status: HttpStatus.LOCKED });
    const [id, changes] = users.update.mock.calls.at(-1) as [string, Partial<User>];
    expect(id).toBe('u1');
    expect(changes.failedLoginCount).toBe(0);
    expect(changes.lockedUntil).toBeInstanceOf(Date);
  });

  it('akun terkunci ditolak bahkan dengan password benar', async () => {
    const { service, tokens } = setup(makeUser({ lockedUntil: new Date(Date.now() + 60_000) }));
    await expect(service.login(login())).rejects.toMatchObject({ status: HttpStatus.LOCKED });
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('akun nonaktif → 403, tapi hanya setelah password terbukti benar', async () => {
    const { service } = setup(makeUser({ isActive: false }));
    await expect(service.login(login('Salah@123'))).rejects.toThrow(UnauthorizedException);
    await expect(service.login(login())).rejects.toThrow(ForbiddenException);
  });
});

describe('generateTemporaryPassword', () => {
  it('selalu memenuhi kebijakan password', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTemporaryPassword()).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12}$/);
    }
  });
});
