import type { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../utils/errorResponse";

export function errorHandler(err: ErrorResponse, req: Request, res: Response, next: NextFunction) {
  const status = err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  res.status(status).json({
    success: false,
    message,
    ...(err.errors ? { fields: err.errors } : {}),
    data: null,
  });
}