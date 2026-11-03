import { EmploymentType, Gender } from '@app/common';
import { Employee } from '../entities/employee.entity';

export interface EmployeeView {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  gender: Gender;
  birthDate: string;
  joinDate: string;
  employmentType: EmploymentType;
  isActive: boolean;
  version: number;
  department: { id: string; code: string; name: string };
  position: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export function toEmployeeView(employee: Employee): EmployeeView {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone,
    gender: employee.gender,
    birthDate: employee.birthDate,
    joinDate: employee.joinDate,
    employmentType: employee.employmentType,
    isActive: employee.isActive,
    version: employee.version,
    department: {
      id: employee.departmentId,
      code: employee.department?.code ?? '',
      name: employee.department?.name ?? '',
    },
    position: { id: employee.positionId, name: employee.position?.name ?? '' },
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}
