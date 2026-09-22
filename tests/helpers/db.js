import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { loadConfig } from "../../src/config/index.js";
import { createSequelize } from "../../src/db/sequelize.js";

// Параметры сервера берутся из .env, как и у приложения, но база — отдельная (DB_NAME_TEST).
// process.loadEnvFile не подходит: Jest даёт тестам собственную копию process.env
if (existsSync(".env")) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(".env", "utf8")))) {
    process.env[key] ??= value;
  }
}
process.env.TZ ??= "UTC";

export function testDbConfig() {
  const { db } = loadConfig(process.env);
  return { ...db, name: db.testName, logSql: false };
}

export function createTestSequelize() {
  return createSequelize({ db: testDbConfig() });
}
