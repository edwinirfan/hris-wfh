import { EmploymentType, Gender, Role } from '../enums';

/**
 * Data demo dengan UUID tetap supaya tiap service bisa men-seed bagiannya sendiri
 * (employee_db, auth_db, attendance_db) dan tetap saling konsisten.
 */
export const DEMO_DEPARTMENTS = [
  { id: 'd0000000-0000-4000-8000-000000000001', code: 'HRD', name: 'Human Resources' },
  { id: 'd0000000-0000-4000-8000-000000000002', code: 'IT', name: 'Information Technology' },
  { id: 'd0000000-0000-4000-8000-000000000003', code: 'FIN', name: 'Finance & Accounting' },
  { id: 'd0000000-0000-4000-8000-000000000004', code: 'MKT', name: 'Marketing' },
] as const;

const [HRD, IT, FIN, MKT] = DEMO_DEPARTMENTS.map((d) => d.id);

export const DEMO_POSITIONS = [
  { id: 'b0000000-0000-4000-8000-000000000001', departmentId: HRD, name: 'HR Manager' },
  { id: 'b0000000-0000-4000-8000-000000000002', departmentId: HRD, name: 'HR Generalist' },
  { id: 'b0000000-0000-4000-8000-000000000003', departmentId: IT, name: 'Software Engineer' },
  { id: 'b0000000-0000-4000-8000-000000000004', departmentId: IT, name: 'QA Engineer' },
  { id: 'b0000000-0000-4000-8000-000000000005', departmentId: IT, name: 'DevOps Engineer' },
  { id: 'b0000000-0000-4000-8000-000000000006', departmentId: FIN, name: 'Accountant' },
  { id: 'b0000000-0000-4000-8000-000000000007', departmentId: FIN, name: 'Finance Staff' },
  { id: 'b0000000-0000-4000-8000-000000000008', departmentId: MKT, name: 'Digital Marketing' },
  { id: 'b0000000-0000-4000-8000-000000000009', departmentId: MKT, name: 'Brand Specialist' },
] as const;

const position = (name: string) => DEMO_POSITIONS.find((p) => p.name === name)!;

export const DEMO_ADMIN_PASSWORD = 'Admin@12345';
export const DEMO_EMPLOYEE_PASSWORD = 'Karyawan@123';

export interface DemoEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  gender: Gender;
  birthDate: string;
  departmentId: string;
  positionId: string;
  positionName: string;
  joinDate: string;
  employmentType: EmploymentType;
  isActive: boolean;
  role: Role;
  password: string;
}

function employee(
  seq: number,
  data: Omit<DemoEmployee, 'id' | 'departmentId' | 'positionId' | 'positionName' | 'role' | 'password' | 'isActive'> & {
    position: string;
    role?: Role;
    isActive?: boolean;
  },
): DemoEmployee {
  const pos = position(data.position);
  const role = data.role ?? Role.EMPLOYEE;
  const { position: _position, ...rest } = data;
  return {
    ...rest,
    id: `e0000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    departmentId: pos.departmentId,
    positionId: pos.id,
    positionName: pos.name,
    role,
    isActive: data.isActive ?? true,
    password: role === Role.ADMIN_HR ? DEMO_ADMIN_PASSWORD : DEMO_EMPLOYEE_PASSWORD,
  };
}

export const DEMO_EMPLOYEES: DemoEmployee[] = [
  employee(1, {
    employeeCode: 'DXA-0001',
    fullName: 'Rina Kartika',
    email: 'admin@hris.local',
    phone: '081210000001',
    gender: Gender.FEMALE,
    birthDate: '1988-04-12',
    joinDate: '2015-02-02',
    employmentType: EmploymentType.PERMANENT,
    position: 'HR Manager',
    role: Role.ADMIN_HR,
  }),
  employee(2, {
    employeeCode: 'DXA-0002',
    fullName: 'Budi Santoso',
    email: 'budi@hris.local',
    phone: '081210000002',
    gender: Gender.MALE,
    birthDate: '1994-09-21',
    joinDate: '2019-07-01',
    employmentType: EmploymentType.PERMANENT,
    position: 'Software Engineer',
  }),
  employee(3, {
    employeeCode: 'DXA-0003',
    fullName: 'Siti Rahmawati',
    email: 'siti@hris.local',
    phone: '081210000003',
    gender: Gender.FEMALE,
    birthDate: '1996-01-05',
    joinDate: '2020-03-16',
    employmentType: EmploymentType.PERMANENT,
    position: 'Accountant',
  }),
  employee(4, {
    employeeCode: 'DXA-0004',
    fullName: 'Andi Pratama',
    email: 'andi@hris.local',
    phone: '081210000004',
    gender: Gender.MALE,
    birthDate: '1998-11-30',
    joinDate: '2022-08-01',
    employmentType: EmploymentType.CONTRACT,
    position: 'Digital Marketing',
  }),
  employee(5, {
    employeeCode: 'DXA-0005',
    fullName: 'Dewi Lestari',
    email: 'dewi@hris.local',
    phone: '081210000005',
    gender: Gender.FEMALE,
    birthDate: '1997-06-18',
    joinDate: '2021-05-10',
    employmentType: EmploymentType.PERMANENT,
    position: 'QA Engineer',
  }),
  employee(6, {
    employeeCode: 'DXA-0006',
    fullName: 'Fajar Nugroho',
    email: 'fajar@hris.local',
    phone: '081210000006',
    gender: Gender.MALE,
    birthDate: '2001-02-14',
    joinDate: '2025-09-01',
    employmentType: EmploymentType.INTERN,
    position: 'DevOps Engineer',
  }),
  employee(7, {
    employeeCode: 'DXA-0007',
    fullName: 'Agus Wijaya',
    email: 'agus@hris.local',
    phone: '081210000007',
    gender: Gender.MALE,
    birthDate: '1990-12-03',
    joinDate: '2017-01-09',
    employmentType: EmploymentType.PERMANENT,
    position: 'Finance Staff',
    isActive: false,
  }),
];

export const demoDepartmentName = (departmentId: string) => DEMO_DEPARTMENTS.find((d) => d.id === departmentId)!.name;
