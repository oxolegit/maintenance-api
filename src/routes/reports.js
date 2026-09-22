import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { equipmentLoadQuerySchema } from "../validators/reports.js";

export function createReportsRouter(controller) {
  const router = Router();

  router.get(
    "/equipment-load",
    validate({ query: equipmentLoadQuerySchema }),
    controller.equipmentLoad,
  );

  return router;
}
