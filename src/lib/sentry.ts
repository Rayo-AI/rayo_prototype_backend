import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";
import ENV from "../../db/env.ts";

/**
 * Capture error with Sentry without logging to console
 * Used in error handlers and middleware to silently report errors
 * In development mode, only logs to console without sending to Sentry
 */
export function captureError(
  error: Error | string,
  context?: Record<string, any>,
  level: "fatal" | "error" | "warning" | "info" = "error"
) {
  // Safely extract the message and stack whether 'error' is a string or an Error object
  const safeMessage = typeof error === "string" ? error : error.message || "Unknown error";
  const safeStack = typeof error === "string" ? undefined : error.stack;

  if (ENV.NODE_ENV === "development") {
    // In development, only log safely to console for debugging
    console.error(`[Dev Error]`, {
      message: safeMessage,
      stack: safeStack,
      context
    });
    return;
  }

  // In production, log safely and send to Sentry
  console.error(`[${level.toUpperCase()}] Sentry Capture:`, {
    message: safeMessage,
    context
  });

  Sentry.captureException(error, {
    level,
    contexts: {
      custom: context,
    },
  });
}

/**
 * Capture message with Sentry
 * In development mode, only logs to console without sending to Sentry
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" = "error",
  context?: Record<string, any>
) {
  if (ENV.NODE_ENV === "development") {
    // In development, only log to console
    console.log(`[Dev ${level.toUpperCase()}]`, message, context);
    return;
  }

  // In production, send to Sentry
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
