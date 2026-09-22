import { existsSync } from "node:fs";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./logger.js";
import { createStorage, createRepositories } from "./repositories/index.js";
import { createSequelize, pingDatabase } from "./db/sequelize.js";
import { createApp } from "./app.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
// Sequelize разбирает строки дат в локальном времени процесса — работаем в UTC
process.env.TZ ??= "UTC";

const config = loadConfig(process.env);
const logger = createLogger(config);

const sequelize = createSequelize({ db: config.db, logger });
try {
  await sequelize.authenticate();
} catch (error) {
  logger.fatal(
    { err: error, host: config.db.host, port: config.db.port, database: config.db.name },
    "нет соединения с PostgreSQL",
  );
  process.exit(1);
}

const storage = createStorage(config.storage);
const repositories = await createRepositories({ storage });
const app = createApp({
  config,
  repositories,
  logger,
  checkDatabase: () => pingDatabase(sequelize),
});

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.env,
      storage: config.storage.driver,
      database: config.db.name,
    },
    "сервер запущен",
  );
});

function shutdown(signal) {
  logger.info({ signal }, "остановка сервера");
  server.close(async () => {
    await sequelize.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "необработанное отклонение промиса");
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "необработанное исключение");
  shutdown("uncaughtException");
});
