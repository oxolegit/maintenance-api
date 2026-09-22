import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";
import { createSitesController } from "../controllers/sitesController.js";
import { createEquipmentController } from "../controllers/equipmentController.js";
import { createPassportController } from "../controllers/passportController.js";
import { createRequestsController } from "../controllers/requestsController.js";
import { createTechniciansController } from "../controllers/techniciansController.js";
import { createAssigneesController } from "../controllers/assigneesController.js";
import { createHealthRouter } from "./health.js";
import { createSitesRouter } from "./sites.js";
import { createEquipmentRouter } from "./equipment.js";
import { createRequestsRouter } from "./requests.js";
import { createTechniciansRouter } from "./technicians.js";

export function createApiRouter({ services, checkDatabase }) {
  const router = Router();

  const sitesController = createSitesController(services);
  const equipmentController = createEquipmentController(services);
  const passportController = createPassportController(services);
  const requestsController = createRequestsController(services);
  const techniciansController = createTechniciansController(services);
  const assigneesController = createAssigneesController(services);

  router.use("/health", createHealthRouter(createHealthController({ checkDatabase })));
  router.use("/sites", createSitesRouter(sitesController));
  router.use(
    "/equipment",
    createEquipmentRouter({ equipmentController, requestsController, passportController }),
  );
  router.use("/requests", createRequestsRouter(requestsController, assigneesController));
  router.use("/technicians", createTechniciansRouter(techniciansController));

  return router;
}
