import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { createApiRouter } from "./routes/index.js";
import { createServices } from "./services/index.js";
import { requestId } from "./middlewares/requestId.js";
import { createRequestLogger } from "./middlewares/requestLogger.js";
import { createCors } from "./middlewares/cors.js";
import { createRateLimiter } from "./middlewares/rateLimiter.js";
import { createApiKeyAuth } from "./middlewares/apiKeyAuth.js";
import { notFound } from "./middlewares/notFound.js";
import { createErrorHandler } from "./middlewares/errorHandler.js";
import { createLogger } from "./logger.js";
import { createOpenMeteoClient } from "./clients/openMeteo.js";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

export function createApp({
  config,
  repositories,
  logger = createLogger(config),
  weatherClient = createOpenMeteoClient(config.weather),
  checkDatabase,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("env", config.env);

  const services = createServices({ repositories, weatherClient, config, logger });

  // Порядок важен: идентификатор запроса нужен всем последующим слоям (логгеру и обработчику
  // ошибок), логгер подключается до защитных middleware, чтобы фиксировать и отклонённые запросы.
  app.use(requestId);
  app.use(createRequestLogger(logger));
  app.use(
    helmet({
      // локально страница открывается по http — без этого браузер пытался бы перейти на https
      contentSecurityPolicy: {
        directives: { upgradeInsecureRequests: config.isProduction ? [] : null },
      },
    }),
  );
  app.use(createCors(config.cors));
  app.use("/api", createRateLimiter(config.rateLimit));
  app.use("/api", createApiKeyAuth({ apiKey: config.apiKey, logger }));
  app.use(express.json({ limit: config.bodyLimit }));

  app.use("/api", createApiRouter({ services, checkDatabase }));
  app.use(express.static(PUBLIC_DIR));

  app.use(notFound);
  app.use(createErrorHandler({ logger, isProduction: config.isProduction }));

  return app;
}
