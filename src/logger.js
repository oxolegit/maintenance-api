import pino from "pino";

export function createLogger({ logLevel = "info" } = {}) {
  return pino({ level: logLevel });
}
