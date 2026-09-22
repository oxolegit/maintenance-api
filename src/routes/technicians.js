import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import {
  createTechnicianSchema,
  updateTechnicianSchema,
  technicianListQuerySchema,
} from "../validators/technicians.js";

export function createTechniciansRouter(controller) {
  const router = Router();

  router.get("/", validate({ query: technicianListQuerySchema }), controller.list);
  router.post("/", validate({ body: createTechnicianSchema }), controller.create);
  router.get("/:id", validate({ params: idParams }), controller.getById);
  router.patch(
    "/:id",
    validate({ params: idParams, body: updateTechnicianSchema }),
    controller.update,
  );
  router.delete("/:id", validate({ params: idParams }), controller.remove);

  return router;
}
