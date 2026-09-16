import { existsSync } from "node:fs";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./logger.js";
import { createStorage, createRepositories } from "./repositories/index.js";
import { createApp } from "./app.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const config = loadConfig(process.env);
const logger = createLogger(config);

const storage = createStorage(config.storage);
const repositories = await createRepositories({ storage });
const app = createApp({ config, repositories, logger });

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env, storage: config.storage.driver },
    "сервер запущен",
  );
});

function shutdown(signal) {
  logger.info({ signal }, "остановка сервера");
  server.close(() => process.exit(0));
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
