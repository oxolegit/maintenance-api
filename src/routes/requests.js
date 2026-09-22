import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import {
  createRequestSchema,
  updateRequestSchema,
  changeStatusSchema,
  requestListQuerySchema,
  batchRequestsSchema,
} from "../validators/requests.js";
import { assignBrigadeSchema, assigneeParams } from "../validators/assignees.js";
import { writeOffSchema, requestPartParams } from "../validators/parts.js";

export function createRequestsRouter(controller, assigneesController, partsController) {
  const router = Router();

  router.get("/", validate({ query: requestListQuerySchema }), controller.list);
  router.post("/", validate({ body: createRequestSchema }), controller.create);
  router.post("/batch", validate({ body: batchRequestsSchema }), controller.importMany);
  router.get("/:id", validate({ params: idParams }), controller.getById);
  router.patch(
    "/:id",
    validate({ params: idParams, body: updateRequestSchema }),
    controller.update,
  );
  router.patch(
    "/:id/status",
    validate({ params: idParams, body: changeStatusSchema }),
    controller.changeStatus,
  );
  router.get("/:id/history", validate({ params: idParams }), controller.history);
  router.delete("/:id", validate({ params: idParams }), controller.remove);

  // бригада — подресурс заявки: POST задаёт состав целиком, DELETE снимает одного специалиста
  router.get("/:id/assignees", validate({ params: idParams }), assigneesController.list);
  router.post(
    "/:id/assignees",
    validate({ params: idParams, body: assignBrigadeSchema }),
    assigneesController.assign,
  );
  router.delete(
    "/:id/assignees/:technicianId",
    validate({ params: assigneeParams }),
    assigneesController.remove,
  );

  // расход запчастей по заявке: POST списывает позиции со склада, DELETE возвращает позицию
  router.get("/:id/parts", validate({ params: idParams }), partsController.listByRequest);
  router.post(
    "/:id/parts",
    validate({ params: idParams, body: writeOffSchema }),
    partsController.writeOff,
  );
  router.delete(
    "/:id/parts/:partId",
    validate({ params: requestPartParams }),
    partsController.returnToStock,
  );

  return router;
}
