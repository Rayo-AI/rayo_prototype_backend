import ENV from "../db/env.ts";
import app from "./app.ts";
import { logger } from "./lib/logger.ts";
import { captureError } from "./lib/sentry.ts";

const rawPort = ENV.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    captureError(err, { port }, "fatal");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  captureError(error, { type: "uncaughtException" }, "fatal");
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  captureError(new Error(String(reason)), {
    type: "unhandledRejection",
    promise: String(promise),
  }, "error");
});
