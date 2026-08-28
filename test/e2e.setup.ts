process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL ??=
  'postgresql://fpc_dev:fpc_dev_password@localhost:5432/fpc_dev';
process.env.JWT_SECRET ??=
  'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.REFRESH_TOKEN_EXPIRES_IN ??= '7d';
process.env.REFRESH_TOKEN_COOKIE_NAME ??= 'refresh_token';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.PATIENT_DOCUMENT_STORAGE_DRIVER ??= 'memory';
process.env.PATIENT_DOCUMENT_MAX_BYTES ??= '10485760';
