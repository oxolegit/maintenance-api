import cors from "cors";

export function createCors({ origins }) {
  return cors({
    origin(origin, callback) {
      callback(null, !origin || origins.includes(origin));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-API-Key", "X-Request-Id"],
    exposedHeaders: ["Location", "X-Request-Id", "RateLimit", "RateLimit-Policy", "Retry-After"],
    maxAge: 600,
  });
}
