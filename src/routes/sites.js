import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import {
  createSiteSchema,
  updateSiteSchema,
  siteListQuerySchema,
  siteSummaryQuerySchema,
} from "../validators/sites.js";
import { equipmentListQuerySchema } from "../validators/equipment.js";

export function createSitesRouter(controller) {
  const router = Router();

  router.get("/", validate({ query: siteListQuerySchema }), controller.list);
  router.post("/", validate({ body: createSiteSchema }), controller.create);
  router.get("/:id", validate({ params: idParams }), controller.getById);
  router.patch("/:id", validate({ params: idParams, body: updateSiteSchema }), controller.update);
  router.delete("/:id", validate({ params: idParams }), controller.remove);

  router.get(
    "/:id/summary",
    validate({ params: idParams, query: siteSummaryQuerySchema }),
    controller.summary,
  );
  router.get(
    "/:id/equipment",
    validate({ params: idParams, query: equipmentListQuerySchema }),
    controller.listEquipment,
  );

  return router;
}
