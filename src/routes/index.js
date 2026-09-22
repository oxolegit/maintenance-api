import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";
import { createEquipmentController } from "../controllers/equipmentController.js";
import { createRequestsController } from "../controllers/requestsController.js";
import { createHealthRouter } from "./health.js";
import { createEquipmentRouter } from "./equipment.js";
import { createRequestsRouter } from "./requests.js";

export function createApiRouter({ services, checkDatabase }) {
  const router = Router();

  const equipmentController = createEquipmentController(services);
  const requestsController = createRequestsController(services);

  router.use("/health", createHealthRouter(createHealthController({ checkDatabase })));
  router.use("/equipment", createEquipmentRouter({ equipmentController, requestsController }));
  router.use("/requests", createRequestsRouter(requestsController));

  return router;
}
