import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Schema for the process environment. Validated once at boot so the app fails
 * fast and loud if a required variable is missing or malformed.
 */
export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(0)
  @Max(65535)
  PORT: number = 3000;

  /**
   * Full Postgres connection string (e.g. Neon). When set it wins over the
   * individual DB_* vars below — handy for hosted Postgres.
   */
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  // Individual connection params — used for local dev / when DATABASE_URL is unset.
  @IsOptional()
  @IsString()
  DB_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  DB_PORT?: number;

  @IsOptional()
  @IsString()
  DB_USERNAME?: string;

  @IsOptional()
  @IsString()
  DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DB_NAME?: string;

  /** "true" enables TLS (required by Neon and most hosted Postgres). */
  @IsOptional()
  @IsString()
  DB_SSL?: string;

  /** "true" runs pending migrations on boot (set on the deployed API). */
  @IsOptional()
  @IsString()
  DB_MIGRATIONS_RUN?: string;

  /** "true" seeds the shared system categories on boot if missing. */
  @IsOptional()
  @IsString()
  SEED_SYSTEM_CATEGORIES?: string;

  /** "true" syncs today's FX rates on boot (keeps the live demo's FX populated). */
  @IsOptional()
  @IsString()
  FX_SYNC_ON_BOOT?: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  /** e.g. "1d", "12h" — parsed by @nestjs/jwt. */
  @IsString()
  JWT_EXPIRES_IN = '1d';

  /** Comma-separated list of allowed browser origins. */
  @IsString()
  CORS_ORIGINS = 'http://localhost:4200';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }
  return validated;
}
