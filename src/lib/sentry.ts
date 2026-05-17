import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";
import ENV from "../../db/env.ts";

// Initialize Sentry
Sentry.init({
  dsn: ENV.SENTRY_DSN,
  environment: ENV.NODE_ENV,
  tracesSampleRate: 0.1, // Adjust this value in production
  sendDefaultPii: true,
  attachStacktrace: true,
  debug: false, // Disable debug logging
});

/**
 * Capture error with Sentry without logging to console
 * Used in error handlers and middleware to silently report errors
 */
export function captureError(
  error: Error | string,
  context?: Record<string, any>,
  level: "fatal" | "error" | "warning" | "info" = "error"
) {
  if (ENV.NODE_ENV === "development") {
    // In development, you can optionally log to console for debugging
    console.error("[Sentry Captured]", error, context);
  }

  Sentry.captureException(error, {
    level,
    contexts: {
      custom: context,
    },
  });
}

/**
 * Capture message with Sentry
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" = "error",
  context?: Record<string, any>
) {
  Sentry.captureMessage(message, level);

  if (context) {
    Sentry.setContext("custom", context);
  }
}

/**
 * Capture request context for better error tracking
 */
export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: "fatal" | "error" | "warning" | "info" = "info",
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Start a performance transaction
 * Note: This is available in Enterprise plans with Tracing enabled
 */
export function startTransaction(name: string, op: string) {
  // Transaction tracking available with Tracing feature
  // Basic error capture is enabled by default
  return {
    finish: () => {
      /* no-op */
    },
    setStatus: (status: string) => {
      /* no-op */
    },
  };
}
