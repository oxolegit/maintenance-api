import { NotFoundError } from "../errors/index.js";

export function notFound(req, _res, next) {
  next(
    new NotFoundError(`Маршрут ${req.method} ${req.originalUrl} не найден`, {
      code: "ROUTE_NOT_FOUND",
    }),
  );
}
