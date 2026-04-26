import pino from "pino";
import ENV from "../../db/env.ts";

const isProduction = ENV.NODE_ENV === "production";

export const logger = pino({
  level: ENV.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  timestamp: pino.stdTimeFunctions.isoTime, // human-readable timestamps in logs
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {
        formatters: {
          level: (label) => ({ level: label }), // log level as string not number in prod
        },
      }
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
});