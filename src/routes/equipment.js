import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  equipmentListQuerySchema,
} from "../validators/equipment.js";

export function createEquipmentRouter(controller) {
  const router = Router();

  router.get("/", validate({ query: equipmentListQuerySchema }), controller.list);
  router.post("/", validate({ body: createEquipmentSchema }), controller.create);
  router.get("/:id", validate({ params: idParams }), controller.getById);
  router.patch(
    "/:id",
    validate({ params: idParams, body: updateEquipmentSchema }),
    controller.update,
  );
  router.delete("/:id", validate({ params: idParams }), controller.remove);

  return router;
}
