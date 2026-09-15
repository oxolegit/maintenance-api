import express from "express";
import { createApiRouter } from "./routes/index.js";

export function createApp({ config }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("env", config.env);

  app.use(express.json());
  app.use("/api", createApiRouter());

  return app;
}
