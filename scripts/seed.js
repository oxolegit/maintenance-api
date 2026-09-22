import { existsSync } from "node:fs";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import { createSequelize } from "../src/db/sequelize.js";
import { createSeeder } from "../src/db/migrator.js";

// Сиды применяются как миграции (up | down | pending | executed), выполненные — в sequelize_seeds
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
process.env.TZ ??= "UTC";

const config = loadConfig(process.env);
const logger = createLogger(config);
const sequelize = createSequelize({ db: config.db, logger });

try {
  await createSeeder({ sequelize, logger }).runAsCLI();
} finally {
  await sequelize.close();
}
