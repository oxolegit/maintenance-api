import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.js";
import { createPartSchema, updatePartSchema, partListQuerySchema } from "../validators/parts.js";

export function createPartsRouter(controller) {
  const router = Router();

  router.get("/", validate({ query: partListQuerySchema }), controller.list);
  router.post("/", validate({ body: createPartSchema }), controller.create);
  router.get("/:id", validate({ params: idParams }), controller.getById);
  router.patch("/:id", validate({ params: idParams, body: updatePartSchema }), controller.update);
  router.delete("/:id", validate({ params: idParams }), controller.remove);

  return router;
}
