import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";
import { createEquipmentController } from "../controllers/equipmentController.js";
import { createHealthRouter } from "./health.js";
import { createEquipmentRouter } from "./equipment.js";

export function createApiRouter({ services }) {
  const router = Router();

  router.use("/health", createHealthRouter(createHealthController()));
  router.use("/equipment", createEquipmentRouter(createEquipmentController(services)));

  return router;
}
