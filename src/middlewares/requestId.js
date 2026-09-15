import { randomUUID } from "node:crypto";

const HEADER = "X-Request-Id";
const SAFE_ID = /^[\w.-]{1,64}$/;

export function requestId(req, res, next) {
  const incoming = req.get(HEADER);
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID().slice(0, 8);
  res.set(HEADER, req.id);
  next();
}
