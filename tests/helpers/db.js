import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { loadConfig } from "../../src/config/index.js";
import { createSequelize } from "../../src/db/sequelize.js";
import { getModels } from "../../src/db/models/index.js";

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

// Одно соединение на файл тестов: открывается при первом обращении, закрывается в afterAll
let shared = null;

export function getTestSequelize() {
  shared ??= createTestSequelize();
  return shared;
}

export async function truncateAll() {
  if (!shared) {
    return;
  }
  const tables = Object.values(getModels(shared)).map((model) => model.getTableName());
  await shared.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

export async function closeTestDb() {
  if (shared) {
    await shared.close();
    shared = null;
  }
}

// Перехват SQL-запросов, выполненных во время fn: для проверки, что списки не порождают N+1
export async function captureQueries(fn) {
  const sequelize = getTestSequelize();
  const queries = [];
  const previous = sequelize.options.logging;
  sequelize.options.logging = (sql) => queries.push(sql);
  try {
    await fn();
  } finally {
    sequelize.options.logging = previous;
  }
  return queries;
}
