import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuthPatterns, CreateEmployeeDto, EmployeePatterns, Role } from '@app/common';
import { EmployeesFacade } from './employees.facade';

const employee = { id: 'e9', email: 'baru@hris.local', fullName: 'Karyawan Baru' };
const dto = { email: employee.email } as CreateEmployeeDto;

function client(handlers: Record<string, () => unknown>) {
  return {
    send: jest.fn((pattern: string) => {
      const handler = handlers[pattern];
      if (!handler) return throwError(() => new Error(`unexpected ${pattern}`));
      return handler() as never;
    }),
  };
}

describe('EmployeesFacade.create (saga)', () => {
  it('sukses: karyawan & akun dibuat, password sementara dikembalikan', async () => {
    const employees = client({ [EmployeePatterns.CREATE]: () => of(employee) });
    const auth = client({
      [AuthPatterns.CREATE_USER]: () =>
        of({ user: { email: employee.email, role: Role.EMPLOYEE }, temporaryPassword: 'Tmp@12345678' }),
    });
    const facade = new EmployeesFacade(employees as never, auth as never);

    const result = await facade.create(dto, 'hr-1');

    expect(result.account).toEqual({ email: employee.email, role: Role.EMPLOYEE, temporaryPassword: 'Tmp@12345678' });
    expect(auth.send).toHaveBeenCalledWith(AuthPatterns.CREATE_USER, {
      employeeId: 'e9',
      email: employee.email,
      role: Role.EMPLOYEE,
    });
    expect(employees.send).not.toHaveBeenCalledWith(EmployeePatterns.COMPENSATE_DELETE, expect.anything());
  });

  it('auth-service menolak → kompensasi hapus karyawan, error diteruskan ke client', async () => {
    const employees = client({
      [EmployeePatterns.CREATE]: () => of(employee),
      [EmployeePatterns.COMPENSATE_DELETE]: () => of({ deleted: true }),
    });
    const auth = client({
      [AuthPatterns.CREATE_USER]: () =>
        throwError(() => ({ statusCode: 409, message: 'Email sudah terdaftar sebagai akun login' })),
    });
    const facade = new EmployeesFacade(employees as never, auth as never);

    await expect(facade.create(dto, 'hr-1')).rejects.toMatchObject({ status: 409 });
    expect(employees.send).toHaveBeenCalledWith(EmployeePatterns.COMPENSATE_DELETE, { id: 'e9' });
  });

  it('auth-service mati → kompensasi tetap jalan, client menerima 503', async () => {
    const employees = client({
      [EmployeePatterns.CREATE]: () => of(employee),
      [EmployeePatterns.COMPENSATE_DELETE]: () => of({ deleted: true }),
    });
    const auth = client({
      [AuthPatterns.CREATE_USER]: () => throwError(() => Object.assign(new Error('connect'), { code: 'ECONNREFUSED' })),
    });
    const facade = new EmployeesFacade(employees as never, auth as never);

    await expect(facade.create(dto, 'hr-1')).rejects.toThrow(ServiceUnavailableException);
    expect(employees.send).toHaveBeenCalledWith(EmployeePatterns.COMPENSATE_DELETE, { id: 'e9' });
  });
});
