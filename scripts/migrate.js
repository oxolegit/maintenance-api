import { existsSync } from "node:fs";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import { createSequelize } from "../src/db/sequelize.js";
import { createMigrator } from "../src/db/migrator.js";

// Команды umzug: up | down [--to 0 | --step N] | pending | executed | create --name <файл> --prefix NONE
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
process.env.TZ ??= "UTC";

const config = loadConfig(process.env);
const logger = createLogger(config);
const sequelize = createSequelize({ db: config.db, logger });

try {
  await createMigrator({ sequelize, logger }).runAsCLI();
} finally {
  await sequelize.close();
}
