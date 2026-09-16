import express from "express";
import { createApiRouter } from "./routes/index.js";
import { createServices } from "./services/index.js";
import { requestId } from "./middlewares/requestId.js";
import { notFound } from "./middlewares/notFound.js";
import { createErrorHandler } from "./middlewares/errorHandler.js";
import { createLogger } from "./logger.js";

export function createApp({ config, repositories, logger = createLogger(config) }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("env", config.env);

  const services = createServices({ repositories });

  app.use(requestId);
  app.use(express.json());

  app.use("/api", createApiRouter({ services }));

  app.use(notFound);
  app.use(createErrorHandler({ logger, isProduction: config.isProduction }));

  return app;
}
