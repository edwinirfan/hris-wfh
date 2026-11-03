import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '@app/common';
import {
  CreateEmployeeDto,
  EMPLOYEE_SERVICE,
  EmployeePatterns,
  EmployeeQueryDto,
  PositionQueryDto,
  Role,
  sendRpc,
  SetEmployeeStatusDto,
  UpdateEmployeeDto,
} from '@app/common';
import { CurrentUser, ResponseMessage, Roles } from '../common/decorators';
import { EmployeesFacade } from './employees.facade';

@ApiTags('Employees (HR)')
@ApiBearerAuth()
@Roles(Role.ADMIN_HR)
@Controller('employees')
export class EmployeesController {
  constructor(
    @Inject(EMPLOYEE_SERVICE) private readonly employeeClient: ClientProxy,
    private readonly facade: EmployeesFacade,
  ) {}

  @Get()
  findAll(@Query() query: EmployeeQueryDto) {
    return sendRpc(this.employeeClient, EmployeePatterns.FIND_ALL, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.facade.findDetail(id);
  }

  @Post()
  @ResponseMessage('Karyawan berhasil ditambahkan')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: JwtPayload) {
    return this.facade.create(dto, user.employeeId);
  }

  @Patch(':id')
  @ResponseMessage('Data karyawan berhasil diperbarui')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: JwtPayload) {
    return sendRpc(this.employeeClient, EmployeePatterns.UPDATE, { id, data: dto, actorId: user.employeeId });
  }

  @Patch(':id/status')
  @ResponseMessage('Status karyawan berhasil diperbarui')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetEmployeeStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return sendRpc(this.employeeClient, EmployeePatterns.SET_STATUS, { id, data: dto, actorId: user.employeeId });
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @ResponseMessage('Password sementara berhasil dibuat')
  resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.facade.resetPassword(id);
  }
}

@ApiTags('Master Data (HR)')
@ApiBearerAuth()
@Roles(Role.ADMIN_HR)
@Controller()
export class MasterDataController {
  constructor(@Inject(EMPLOYEE_SERVICE) private readonly employeeClient: ClientProxy) {}

  @Get('departments')
  departments() {
    return sendRpc(this.employeeClient, EmployeePatterns.DEPARTMENTS, {});
  }

  @Get('positions')
  positions(@Query() query: PositionQueryDto) {
    return sendRpc(this.employeeClient, EmployeePatterns.POSITIONS, query);
  }
}
