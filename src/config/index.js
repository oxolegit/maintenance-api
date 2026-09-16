import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  STORAGE_DRIVER: z.enum(["file", "memory"]).default("file"),
  DATA_DIR: z.string().default("data"),
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
    storage: {
      driver: vars.STORAGE_DRIVER,
      dataDir: vars.DATA_DIR,
    },
  };
}
