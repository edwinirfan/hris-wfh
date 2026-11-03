import Joi from 'joi';

export const gatewayEnvSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  GATEWAY_PORT: Joi.number().port().default(3000),
  PUBLIC_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  AUTH_SERVICE_HOST: Joi.string().default('localhost'),
  AUTH_SERVICE_PORT: Joi.number().port().default(4001),
  EMPLOYEE_SERVICE_HOST: Joi.string().default('localhost'),
  EMPLOYEE_SERVICE_PORT: Joi.number().port().default(4002),
  ATTENDANCE_SERVICE_HOST: Joi.string().default('localhost'),
  ATTENDANCE_SERVICE_PORT: Joi.number().port().default(4003),
  FILE_URL_SECRET: Joi.string().min(32).required(),
  FILE_URL_TTL_SECONDS: Joi.number().integer().min(30).default(300),
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_DIR: Joi.string().default('./storage'),
  S3_ENDPOINT: Joi.string().default('localhost'),
  S3_PORT: Joi.number().port().default(9000),
  S3_USE_SSL: Joi.boolean().default(false),
  S3_ACCESS_KEY: Joi.string().default('minioadmin'),
  S3_SECRET_KEY: Joi.string().default('minioadmin'),
  S3_BUCKET: Joi.string().default('attendance-photos'),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
  THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
});
