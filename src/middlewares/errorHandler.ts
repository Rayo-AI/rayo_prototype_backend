import type { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../utils/errorResponse";
import { captureError } from "../lib/sentry.ts";
import ENV from "../../db/env.ts";

export function errorHandler(
  err: ErrorResponse,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status = err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  // Capture error to Sentry (silent, no console output)
  if (status >= 500) {
    captureError(err, {
      statusCode: status,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    }, "error");
  } else if (status >= 400) {
    // Capture 4xx errors as warnings
    captureError(err, {
      statusCode: status,
      method: req.method,
      url: req.originalUrl,
    }, "warning");
  }

  // Respond to client without exposing internal error details
  res.status(status).json({
    success: false,
    message:
      status === 500 && ENV.NODE_ENV === "production"
        ? "An error occurred. Please try again later."
        : message,
    ...(err.errors ? { fields: err.errors } : {}),
    data: null,
  });
}