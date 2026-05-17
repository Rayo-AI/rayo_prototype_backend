import type { Request, Response, NextFunction } from "express";
import { captureError } from "../lib/sentry.ts";

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch((error) => {
      // Capture async errors to Sentry
      captureError(error, {
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
      next(error);
    });
  };
}