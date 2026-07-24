import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+(ms|s|m|h|d|w|y)$/)
    .default('1h'),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string()
    .pattern(/^\d+(ms|s|m|h|d|w|y)$/)
    .default('7d'),
  REFRESH_TOKEN_COOKIE_NAME: Joi.string().default('refresh_token'),
  CORS_ORIGIN: Joi.string().uri().invalid('*').required(),
  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).optional(),
  GEMINI_API_KEY: Joi.string().trim().optional().allow(''),
  GEMINI_MODEL: Joi.string().trim().default('gemini-2.0-flash'),
  PATIENT_SUMMARY_RATE_LIMIT: Joi.number().integer().min(1).default(10),
  PATIENT_SUMMARY_RATE_LIMIT_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(60),
  PATIENT_SUMMARY_BATCH_SIZE: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10),
  PATIENT_SUMMARY_PROCESSING_TIMEOUT_SECONDS: Joi.number()
    .integer()
    .min(60)
    .default(300),
  PATIENT_SUMMARY_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(3),
});
