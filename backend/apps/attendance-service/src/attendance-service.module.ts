import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import Joi from 'joi';
import {
  baseEnvSchema,
  EMPLOYEE_SERVICE,
  EventPublisher,
  eventsPublisherProvider,
  mysqlOptions,
  tcpClientProvider,
} from '@app/common';
import { AttendanceQueryService } from './attendance/attendance-query.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { ClockService } from './common/clock.service';
import { EmployeeEventsController } from './employee-refs/employee-events.controller';
import { EmployeeRefsService } from './employee-refs/employee-refs.service';
import { AttendanceLog } from './entities/attendance-log.entity';
import { Attendance } from './entities/attendance.entity';
import { EmployeeRef } from './entities/employee-ref.entity';
import { WorkSchedule } from './entities/work-schedule.entity';
import { InitAttendanceSchema1762059800000 } from './migrations/1762059800000-InitAttendanceSchema';
import { ScheduleService } from './schedule/schedule.service';
import { AttendanceSeeder } from './seed/attendance.seeder';

const entities = [WorkSchedule, EmployeeRef, Attendance, AttendanceLog];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: Joi.object({
        ...baseEnvSchema,
        ATTENDANCE_SERVICE_PORT: Joi.number().port().default(4003),
        ATTENDANCE_DB_NAME: Joi.string().default('hris_attendance_db'),
        EMPLOYEE_SERVICE_HOST: Joi.string().default('localhost'),
        EMPLOYEE_SERVICE_PORT: Joi.number().port().default(4002),
        SEED_DEMO_DATA: Joi.boolean().default(true),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mysqlOptions(config, 'ATTENDANCE_DB_NAME', entities, [InitAttendanceSchema1762059800000]),
    }),
    TypeOrmModule.forFeature(entities),
    ClientsModule.registerAsync([
      eventsPublisherProvider(),
      tcpClientProvider(EMPLOYEE_SERVICE, 'EMPLOYEE_SERVICE_HOST', 'EMPLOYEE_SERVICE_PORT'),
    ]),
  ],
  controllers: [AttendanceController, EmployeeEventsController],
  providers: [
    AttendanceService,
    AttendanceQueryService,
    EmployeeRefsService,
    ScheduleService,
    ClockService,
    EventPublisher,
    AttendanceSeeder,
  ],
})
export class AttendanceServiceModule {}
