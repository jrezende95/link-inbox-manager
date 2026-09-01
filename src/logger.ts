import pino from "pino";
import type { Environment } from "./config.js";

export function createLogger(env: Environment) {
  return pino({ level: env.LINK_LOG_LEVEL, redact: ["apiKey", "authorization", "*.text", "*.draft", "*.inboundMessage"] });
}
