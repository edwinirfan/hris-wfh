import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import Joi from 'joi';
import { baseEnvSchema, mysqlOptions } from '@app/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { EmployeeEventsController } from './auth/employee-events.controller';
import { TokenService } from './auth/token.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { InitAuthSchema1762059600000 } from './migrations/1762059600000-InitAuthSchema';
import { AuthSeeder } from './seed/auth.seeder';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: Joi.object({
        ...baseEnvSchema,
        AUTH_SERVICE_PORT: Joi.number().port().default(4001),
        AUTH_DB_NAME: Joi.string().default('hris_auth_db'),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_TTL: Joi.number().integer().min(60).default(900),
        REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(7),
        BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(12),
        LOGIN_MAX_ATTEMPTS: Joi.number().integer().min(1).default(5),
        LOGIN_LOCK_MINUTES: Joi.number().integer().min(1).default(15),
        SEED_DEMO_DATA: Joi.boolean().default(true),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mysqlOptions(config, 'AUTH_DB_NAME', [User, RefreshToken], [InitAuthSchema1762059600000]),
    }),
    TypeOrmModule.forFeature([User, RefreshToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { issuer: 'hris-auth-service', audience: 'hris-api' },
      }),
    }),
  ],
  controllers: [AuthController, EmployeeEventsController],
  providers: [AuthService, TokenService, AuthSeeder],
})
export class AuthServiceModule {}
