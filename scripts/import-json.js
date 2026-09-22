import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import { createSequelize } from "../src/db/sequelize.js";
import { importJson } from "../src/db/importJson.js";

// node scripts/import-json.js [--dir data] [--dry-run]
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
process.env.TZ ??= "UTC";

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "data" },
    "dry-run": { type: "boolean", default: false },
  },
});

const config = loadConfig(process.env);
const logger = createLogger(config);
const sequelize = createSequelize({ db: config.db, logger });

try {
  const summary = await importJson({ sequelize, dir: values.dir, dryRun: values["dry-run"] });
  logger.info(
    { dir: values.dir, dryRun: values["dry-run"], ...summary },
    values["dry-run"] ? "проверка файлов завершена" : "перенос данных завершён",
  );
} finally {
  await sequelize.close();
}
