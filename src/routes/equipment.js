import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  equipmentListQuerySchema,
} from "../validators/equipment.js";
import { equipmentRequestsQuerySchema } from "../validators/requests.js";

export function createEquipmentRouter({ equipmentController, requestsController }) {
  const router = Router();

  router.get("/", validate({ query: equipmentListQuerySchema }), equipmentController.list);
  router.post("/", validate({ body: createEquipmentSchema }), equipmentController.create);
  router.get("/:id", validate({ params: idParams }), equipmentController.getById);
  router.patch(
    "/:id",
    validate({ params: idParams, body: updateEquipmentSchema }),
    equipmentController.update,
  );
  router.delete("/:id", validate({ params: idParams }), equipmentController.remove);

  router.get(
    "/:id/requests",
    validate({ params: idParams, query: equipmentRequestsQuerySchema }),
    requestsController.listByEquipment,
  );

  return router;
}
