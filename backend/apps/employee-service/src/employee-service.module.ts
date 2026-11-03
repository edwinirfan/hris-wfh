import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import Joi from 'joi';
import { baseEnvSchema, EventPublisher, eventsPublisherProvider, mysqlOptions } from '@app/common';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';

import { Department } from './entities/department.entity';
import { Employee } from './entities/employee.entity';
import { Position } from './entities/position.entity';
import { InitEmployeeSchema1762059700000 } from './migrations/1762059700000-InitEmployeeSchema';
import { EmployeeSeeder } from './seed/employee.seeder';

const entities = [Department, Position, Employee];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: Joi.object({
        ...baseEnvSchema,
        EMPLOYEE_SERVICE_PORT: Joi.number().port().default(4002),
        EMPLOYEE_DB_NAME: Joi.string().default('hris_employee_db'),
        SEED_DEMO_DATA: Joi.boolean().default(true),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mysqlOptions(config, 'EMPLOYEE_DB_NAME', entities, [InitEmployeeSchema1762059700000]),
    }),
    TypeOrmModule.forFeature(entities),
    ClientsModule.registerAsync([eventsPublisherProvider()]),
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService, EventPublisher, EmployeeSeeder],
})
export class EmployeeServiceModule {}
