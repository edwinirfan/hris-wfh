import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import {
  CreateEmployeeRpcDto,
  EmployeePatterns,
  EmployeeQueryDto,
  IdRpcDto,
  PositionQueryDto,
  SetEmployeeStatusRpcDto,
  UpdateEmployeeRpcDto,
} from '@app/common';
import { EmployeesService } from './employees.service';

@Controller()
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @MessagePattern(EmployeePatterns.CREATE, Transport.TCP)
  create(@Payload() dto: CreateEmployeeRpcDto) {
    return this.employees.create(dto);
  }

  @MessagePattern(EmployeePatterns.FIND_ALL, Transport.TCP)
  findAll(@Payload() query: EmployeeQueryDto) {
    return this.employees.findAll(query);
  }

  @MessagePattern(EmployeePatterns.FIND_ONE, Transport.TCP)
  findOne(@Payload() dto: IdRpcDto) {
    return this.employees.findOne(dto.id);
  }

  @MessagePattern(EmployeePatterns.UPDATE, Transport.TCP)
  update(@Payload() dto: UpdateEmployeeRpcDto) {
    return this.employees.update(dto);
  }

  @MessagePattern(EmployeePatterns.SET_STATUS, Transport.TCP)
  setStatus(@Payload() dto: SetEmployeeStatusRpcDto) {
    return this.employees.setStatus(dto);
  }

  @MessagePattern(EmployeePatterns.COMPENSATE_DELETE, Transport.TCP)
  compensateDelete(@Payload() dto: IdRpcDto) {
    return this.employees.compensateDelete(dto.id);
  }

  @MessagePattern(EmployeePatterns.DEPARTMENTS, Transport.TCP)
  departments() {
    return this.employees.findDepartments();
  }

  @MessagePattern(EmployeePatterns.POSITIONS, Transport.TCP)
  positions(@Payload() query: PositionQueryDto) {
    return this.employees.findPositions(query.departmentId);
  }
}
