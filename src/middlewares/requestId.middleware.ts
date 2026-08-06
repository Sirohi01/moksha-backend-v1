import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/** PRD Phase E2 — every response (success or error) carries the ID of the request that produced
 * it, for correlating a user's bug report with a specific line in the server log. Mounted first
 * in app.ts so it's available to every downstream middleware, including the error handler. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
