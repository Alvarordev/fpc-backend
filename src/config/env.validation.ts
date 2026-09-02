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
  // Only read by the standalone demo seed script, declared here so the app
  // still boots when it is present in the environment.
  SEED_DEMO_SEED: Joi.number().integer().optional(),
  SEED_DEMO_FORCE: Joi.boolean().optional(),
  SEED_STAGING_FORCE: Joi.boolean().optional(),
  GEMINI_API_KEY: Joi.string().trim().optional().allow(''),
  GEMINI_MODEL: Joi.string().trim().default('gemini-2.0-flash'),
  PATIENT_SUMMARY_RATE_LIMIT: Joi.number().integer().min(1).default(10),
  PATIENT_SUMMARY_RATE_LIMIT_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(60),
  // Blank (the default) disables the n8n integration entirely — no default
  // URL is set here on purpose, so a copied .env never fires real webhooks.
  N8N_WEBHOOK_URL: Joi.string()
    .trim()
    .uri({ scheme: ['http', 'https'] })
    .optional()
    .allow(''),
  N8N_WEBHOOK_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(30000)
    .default(5000),
  PATIENT_DOCUMENT_STORAGE_DRIVER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.valid('r2').default('r2'),
    otherwise: Joi.valid('r2', 'memory').default('memory'),
  }),
  R2_ACCOUNT_ID: Joi.when('PATIENT_DOCUMENT_STORAGE_DRIVER', {
    is: 'r2',
    then: Joi.string().trim().required(),
    otherwise: Joi.string().trim().optional().allow(''),
  }),
  R2_ACCESS_KEY_ID: Joi.when('PATIENT_DOCUMENT_STORAGE_DRIVER', {
    is: 'r2',
    then: Joi.string().trim().required(),
    otherwise: Joi.string().trim().optional().allow(''),
  }),
  R2_SECRET_ACCESS_KEY: Joi.when('PATIENT_DOCUMENT_STORAGE_DRIVER', {
    is: 'r2',
    then: Joi.string().trim().required(),
    otherwise: Joi.string().trim().optional().allow(''),
  }),
  R2_BUCKET_NAME: Joi.when('PATIENT_DOCUMENT_STORAGE_DRIVER', {
    is: 'r2',
    then: Joi.string().trim().required(),
    otherwise: Joi.string().trim().optional().allow(''),
  }),
  R2_ENDPOINT: Joi.when('PATIENT_DOCUMENT_STORAGE_DRIVER', {
    is: 'r2',
    then: Joi.string()
      .trim()
      .uri({ scheme: ['http', 'https'] })
      .optional(),
    otherwise: Joi.string().trim().optional().allow(''),
  }),
  PATIENT_DOCUMENT_MAX_BYTES: Joi.number()
    .integer()
    .min(1)
    .max(10485760)
    .default(10485760),
});
