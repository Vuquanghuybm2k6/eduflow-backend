import Joi from 'joi';

/**
 * Fail-fast validation of environment variables. Nest reads these from the
 * environment (and the active .env file) at bootstrap, so a missing or
 * malformed value stops the app instead of surfacing as a confusing runtime
 * error later.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  DATABASE_URL: Joi.string().uri().required(),

  BACKEND_PORT: Joi.number().port().default(3000),
  PORT: Joi.number().port().optional(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_RESET_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  COOKIE_SECRET: Joi.string().min(16).required(),

  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),

  EMAIL_USER: Joi.string().allow('').optional(),
  EMAIL_PASSWORD: Joi.string().allow('').optional(),

  FRONTEND_URL: Joi.string().uri().required(),
});
