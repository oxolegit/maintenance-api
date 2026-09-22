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

export function createRequestsRouter(controller, assigneesController) {
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

  return router;
}
