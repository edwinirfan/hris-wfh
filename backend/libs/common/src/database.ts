import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import Joi from 'joi';
import { ValueTransformer } from 'typeorm';

type EntityList = NonNullable<TypeOrmModuleOptions['entities']>;
type MigrationList = (string | (new () => unknown))[];

/**
 * Konfigurasi MySQL per service (database-per-service).
 * - Migration dijalankan otomatis saat start; synchronize dimatikan.
 * - Semua DATETIME disimpan UTC; kolom DATE dikembalikan sebagai string
 *   supaya tanggal tidak bergeser karena konversi zona waktu.
 */
export function mysqlOptions(
  config: ConfigService,
  databaseKey: string,
  entities: EntityList,
  migrations: MigrationList,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.get<string>('DB_PASSWORD') ?? '',
    database: config.getOrThrow<string>(databaseKey),
    entities,
    migrations,
    migrationsRun: true,
    migrationsTransactionMode: 'each',
    synchronize: false,
    timezone: 'Z',
    dateStrings: ['DATE'],
    charset: 'utf8mb4_unicode_ci',
    logging: config.get<string>('DB_LOGGING') === 'true' ? 'all' : ['error', 'warn', 'migration'],
    extra: { connectionLimit: 10 },
    retryAttempts: 10,
    retryDelay: 3000,
  };
}

/** mysql2 mengembalikan DECIMAL sebagai string → ubah ke number */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? null : Number(value)),
};

export const baseEnvSchema = {
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_LOGGING: Joi.string().valid('true', 'false').default('false'),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
};
