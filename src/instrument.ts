import * as Sentry from "@sentry/node";
import ENV from "../db/env.ts";

Sentry.init({
  dsn: ENV.SENTRY_DSN,
  environment: ENV.NODE_ENV,
  tracesSampleRate: ENV.NODE_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: true,
  attachStacktrace: true,
  debug: false,
  enabled: ENV.NODE_ENV !== "development",
  beforeSend(event) {
    if (ENV.NODE_ENV === "development") {
      return null;
    }

    return event;
  },
});