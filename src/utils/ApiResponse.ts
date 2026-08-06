import { Response } from "express";

export interface ResponseMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
  meta?: ResponseMeta
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
    ...(meta && { meta }),
    requestId: res.req.requestId,
  });
}
