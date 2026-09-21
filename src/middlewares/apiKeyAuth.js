import { timingSafeEqual } from "node:crypto";
import { UnauthorizedError } from "../errors/index.js";

const HEADER = "X-API-Key";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function keysMatch(provided, expected) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApiKeyAuth({ apiKey, logger }) {
  if (!apiKey) {
    logger.warn("API_KEY не задан: изменяющие операции доступны без аутентификации");
    return (_req, _res, next) => next();
  }

  return (req, _res, next) => {
    if (!MUTATING_METHODS.has(req.method)) {
      return next();
    }

    const provided = req.get(HEADER);
    if (!provided) {
      return next(new UnauthorizedError(`Для изменяющих операций требуется заголовок ${HEADER}`));
    }
    if (!keysMatch(provided, apiKey)) {
      return next(new UnauthorizedError("Неверный API-ключ"));
    }
    next();
  };
}
