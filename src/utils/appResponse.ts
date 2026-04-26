import type { Response } from "express";

export function appResponse<T>(
  res: Response,
  statusCode: number = 200,
  data?: T,
  message: string = "Success"
) {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data: data ?? null,
  });
}