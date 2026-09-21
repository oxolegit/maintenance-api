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

export function createRequestsRouter(controller) {
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

  return router;
}
