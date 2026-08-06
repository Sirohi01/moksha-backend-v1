import { NextFunction, Request, Response } from "express";
import { isProd } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";

export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.requestId,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let message = "Internal server error";
  let errors: unknown[] = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode >= 500) {
    logger.error(message, { stack: err instanceof Error ? err.stack : err, path: req.originalUrl });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    ...(!isProd && err instanceof Error && { stack: err.stack }),
    requestId: req.requestId,
  });
}
