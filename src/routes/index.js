import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";
import { createHealthRouter } from "./health.js";

export function createApiRouter() {
  const router = Router();

  router.use("/health", createHealthRouter(createHealthController()));

  return router;
}
