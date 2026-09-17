import { rateLimit } from "express-rate-limit";
import { TooManyRequestsError } from "../errors/index.js";

export function createRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError(`Превышен лимит ${max} запросов за ${windowMs / 1000} с`));
    },
  });
}
