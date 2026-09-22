import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  JSON_BODY_LIMIT: z.string().default("100kb"),
  STORAGE_DRIVER: z.enum(["file", "memory"]).default("file"),
  DATA_DIR: z.string().default("data"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().default("maintenance"),
  DB_USER: z.string().default("maintenance"),
  DB_PASSWORD: z.string().min(1, "пароль БД обязателен"),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(0),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_LOG_SQL: z.enum(["true", "false"]).default("false"),
  DB_NAME_TEST: z.string().default("maintenance_test"),
  WEATHER_API_URL: z.url().default("https://api.open-meteo.com/v1/forecast"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  WEATHER_FORECAST_DAYS: z.coerce.number().int().min(1).max(7).default(3),
  WEATHER_MAX_WIND_SPEED_MS: z.coerce.number().nonnegative().default(10),
  WEATHER_MAX_PRECIPITATION_MM: z.coerce.number().nonnegative().default(0),
  WEATHER_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(600000),
  API_KEY: z.string().default(""),
});

function withoutEmptyValues(env) {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
}

export function loadConfig(env = process.env) {
  const result = envSchema.safeParse(withoutEmptyValues(env));

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`некорректные переменные окружения — ${problems}`);
  }

  const vars = result.data;

  return {
    env: vars.NODE_ENV,
    isProduction: vars.NODE_ENV === "production",
    port: vars.PORT,
    logLevel: vars.LOG_LEVEL,
    cors: {
      origins: vars.CORS_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
    rateLimit: {
      windowMs: vars.RATE_LIMIT_WINDOW_MS,
      max: vars.RATE_LIMIT_MAX,
    },
    bodyLimit: vars.JSON_BODY_LIMIT,
    apiKey: vars.API_KEY,
    storage: {
      driver: vars.STORAGE_DRIVER,
      dataDir: vars.DATA_DIR,
    },
    db: {
      host: vars.DB_HOST,
      port: vars.DB_PORT,
      name: vars.DB_NAME,
      user: vars.DB_USER,
      password: vars.DB_PASSWORD,
      pool: { min: vars.DB_POOL_MIN, max: vars.DB_POOL_MAX },
      logSql: vars.DB_LOG_SQL === "true",
      testName: vars.DB_NAME_TEST,
    },
    weather: {
      apiUrl: vars.WEATHER_API_URL,
      timeoutMs: vars.REQUEST_TIMEOUT_MS,
      forecastDays: vars.WEATHER_FORECAST_DAYS,
      maxWindSpeedMs: vars.WEATHER_MAX_WIND_SPEED_MS,
      maxPrecipitationMm: vars.WEATHER_MAX_PRECIPITATION_MM,
      cacheTtlMs: vars.WEATHER_CACHE_TTL_MS,
    },
  };
}
