import { Request } from "express";
import { ResponseMeta } from "./ApiResponse";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PaginationParams {
  /** true only when the caller explicitly sent ?page or ?limit — lets a list endpoint fall back
   * to "return everything" when absent, so existing callers that have never sent these params
   * keep seeing the exact same unpaginated response they always have. */
  requested: boolean;
  page: number;
  limit: number;
  skip: number;
}

/** PRD Phase E2 — pagination is opt-in per request, not a breaking default: a list endpoint using
 * this only slices results when the caller actually asks for a page, so no existing admin-panel
 * call (none of which send ?page/?limit today) changes behavior until the frontend adopts it. */
export function parsePagination(req: Request): PaginationParams {
  const requested = req.query.page !== undefined || req.query.limit !== undefined;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  return { requested, page, limit, skip: (page - 1) * limit };
}

export function buildMeta(page: number, limit: number, total: number): ResponseMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
