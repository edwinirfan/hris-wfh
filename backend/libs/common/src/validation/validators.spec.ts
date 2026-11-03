import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttendanceCaptureDto } from '../dto/attendance.dto';
import { CreateEmployeeDto } from '../dto/employee.dto';
import { dayjs } from '../utils/time';

async function errorsOf<T extends object>(cls: new () => T, plain: object): Promise<Record<string, string[]>> {
  const errors = await validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true });
  return Object.fromEntries(errors.map((e) => [e.property, Object.values(e.constraints ?? {})]));
}

const validEmployee = {
  employeeCode: 'dxa-0100',
  fullName: "Ni Made O'Neil",
  email: '  Made@Example.COM ',
  phone: '0812-3456-7890',
  gender: 'FEMALE',
  birthDate: '1998-02-28',
  departmentId: 'd0000000-0000-4000-8000-000000000002',
  positionId: 'b0000000-0000-4000-8000-000000000003',
  joinDate: '2024-01-15',
  employmentType: 'PERMANENT',
};

describe('CreateEmployeeDto', () => {
  it('data valid lolos dan dinormalisasi (NIK uppercase, email lowercase, HP tanpa strip)', async () => {
    expect(await errorsOf(CreateEmployeeDto, validEmployee)).toEqual({});
    const dto = plainToInstance(CreateEmployeeDto, validEmployee);
    expect(dto.employeeCode).toBe('DXA-0100');
    expect(dto.email).toBe('made@example.com');
    expect(dto.phone).toBe('081234567890');
  });

  it.each([
    ['phone', '021555123'],
    ['phone', '+6281'],
    ['birthDate', dayjs().subtract(16, 'year').format('YYYY-MM-DD')],
    ['birthDate', '1998-02-30'],
    ['joinDate', dayjs().add(31, 'day').format('YYYY-MM-DD')],
    ['employeeCode', 'ab'],
    ['fullName', 'Budi123'],
    ['gender', 'OTHER'],
    ['departmentId', 'bukan-uuid'],
  ])('menolak %s = %p', async (field, value) => {
    const errors = await errorsOf(CreateEmployeeDto, { ...validEmployee, [field]: value });
    expect(Object.keys(errors)).toContain(field);
  });

  it('menolak field yang tidak dikenal (mass assignment)', async () => {
    const errors = await errorsOf(CreateEmployeeDto, { ...validEmployee, isActive: false });
    expect(Object.keys(errors)).toContain('isActive');
  });
});

describe('AttendanceCaptureDto (field multipart berupa string)', () => {
  const valid = { faceCount: '1', faceConfidence: '0.9312', livenessPassed: 'true' };

  it('string multipart diubah ke number/boolean dan lolos', async () => {
    expect(await errorsOf(AttendanceCaptureDto, valid)).toEqual({});
  });

  it.each([
    [{ faceCount: '2' }, 'faceCount'],
    [{ faceCount: '0' }, 'faceCount'],
    [{ faceConfidence: '0.3' }, 'faceConfidence'],
    [{ livenessPassed: 'false' }, 'livenessPassed'],
    [{ latitude: '-6.2' }, 'latitude'],
    [{ latitude: '-6.2', longitude: '200' }, 'longitude'],
    [{ clientTime: 'kemarin' }, 'clientTime'],
  ])('menolak %p', async (override, field) => {
    const errors = await errorsOf(AttendanceCaptureDto, { ...valid, ...override });
    expect(Object.keys(errors)).toContain(field);
  });

  it('lokasi lengkap diterima', async () => {
    expect(
      await errorsOf(AttendanceCaptureDto, { ...valid, latitude: '-6.2', longitude: '106.8', accuracy: '15' }),
    ).toEqual({});
  });
});
