import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import {
  AttendancePatterns,
  AttendanceQueryDto,
  DateQueryDto,
  EmployeeIdRpcDto,
  FindAttendanceRpcDto,
  MyHistoryRpcDto,
  PrecheckRpcDto,
  RecordAttendanceRpcDto,
  StatsQueryDto,
} from '@app/common';
import { ScheduleService } from '../schedule/schedule.service';
import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceService } from './attendance.service';

@Controller()
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly queries: AttendanceQueryService,
    private readonly schedules: ScheduleService,
  ) {}

  @MessagePattern(AttendancePatterns.PRECHECK, Transport.TCP)
  precheck(@Payload() dto: PrecheckRpcDto) {
    return this.attendance.precheck(dto);
  }

  @MessagePattern(AttendancePatterns.CHECK_IN, Transport.TCP)
  checkIn(@Payload() dto: RecordAttendanceRpcDto) {
    return this.attendance.checkIn(dto);
  }

  @MessagePattern(AttendancePatterns.CHECK_OUT, Transport.TCP)
  checkOut(@Payload() dto: RecordAttendanceRpcDto) {
    return this.attendance.checkOut(dto);
  }

  @MessagePattern(AttendancePatterns.TODAY, Transport.TCP)
  today(@Payload() dto: EmployeeIdRpcDto) {
    return this.attendance.today(dto.employeeId);
  }

  @MessagePattern(AttendancePatterns.SCHEDULE, Transport.TCP)
  schedule() {
    return this.schedules.getDefault();
  }

  @MessagePattern(AttendancePatterns.MY_HISTORY, Transport.TCP)
  myHistory(@Payload() dto: MyHistoryRpcDto) {
    return this.queries.myHistory(dto);
  }

  @MessagePattern(AttendancePatterns.FIND_ALL, Transport.TCP)
  findAll(@Payload() query: AttendanceQueryDto) {
    return this.queries.findAll(query);
  }

  @MessagePattern(AttendancePatterns.FIND_ONE, Transport.TCP)
  findOne(@Payload() dto: FindAttendanceRpcDto) {
    return this.queries.findOne(dto);
  }

  @MessagePattern(AttendancePatterns.SUMMARY, Transport.TCP)
  summary(@Payload() query: DateQueryDto) {
    return this.queries.summary(query);
  }

  @MessagePattern(AttendancePatterns.STATS, Transport.TCP)
  stats(@Payload() query: StatsQueryDto) {
    return this.queries.stats(query);
  }

  @MessagePattern(AttendancePatterns.ABSENTEES, Transport.TCP)
  absentees(@Payload() query: DateQueryDto) {
    return this.queries.absentees(query);
  }
}
