import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  equipmentListQuerySchema,
  weatherQuerySchema,
} from "../validators/equipment.js";
import { equipmentRequestsQuerySchema } from "../validators/requests.js";
import { passportSchema } from "../validators/passports.js";

export function createEquipmentRouter({
  equipmentController,
  requestsController,
  passportController,
}) {
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

  router.get(
    "/:id/weather",
    validate({ params: idParams, query: weatherQuerySchema }),
    equipmentController.weather,
  );

  // паспорт — единственный вложенный объект (1:1), поэтому PUT без собственного идентификатора
  router.get("/:id/passport", validate({ params: idParams }), passportController.get);
  router.put(
    "/:id/passport",
    validate({ params: idParams, body: passportSchema }),
    passportController.put,
  );
  router.delete("/:id/passport", validate({ params: idParams }), passportController.remove);

  return router;
}
