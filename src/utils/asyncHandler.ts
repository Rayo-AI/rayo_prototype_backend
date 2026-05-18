import type { Request, Response, NextFunction } from "express";

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Don't capture here - let centralized error handler capture
    // This prevents duplicate Sentry captures
    fn(req, res, next).catch(next);
  };
}