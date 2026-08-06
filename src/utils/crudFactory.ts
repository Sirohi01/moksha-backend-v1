import { Request, Response, Router, RequestHandler } from "express";
import { Model, Document } from "mongoose";
import { asyncHandler } from "./asyncHandler";
import { sendSuccess } from "./ApiResponse";
import { ApiError } from "./ApiError";
import { maybeDecrypt } from "../lib/crypto";
import { parsePagination, buildMeta } from "./pagination";

/** Decrypts top-level string fields on a plain object, gated by EXPOSE_DECRYPTED_DATA. */
function revealSensitiveFields(obj: object, fields: string[]): object {
  const record = obj as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) {
      record[field] = maybeDecrypt(value);
    }
  }
  return record;
}

/**
 * Generates standard admin CRUD handlers (list all / get / create / update / delete) for a Mongoose model.
 * Public-facing read endpoints (filtered to active/published/approved items) are written per-module
 * since their filters differ — this factory only covers the admin management surface.
 *
 * `sensitiveFields` names top-level string fields that are encrypted at rest (see
 * fieldEncryption.ts) — list and getById will decrypt them for the response, gated by the
 * EXPOSE_DECRYPTED_DATA toggle since this is always an admin (not data-owner) view.
 */
export function buildAdminCrudHandlers<T extends Document>(
  model: Model<T>,
  entityName: string,
  sensitiveFields: string[] = []
) {
  const list = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const query = model.find().sort({ createdAt: -1 });
    if (pagination.requested) query.skip(pagination.skip).limit(pagination.limit);

    const [items, total] = await Promise.all([
      query,
      pagination.requested ? model.countDocuments() : Promise.resolve(undefined),
    ]);
    const data = sensitiveFields.length
      ? items.map((item) => revealSensitiveFields(item.toObject(), sensitiveFields))
      : items;
    const meta = pagination.requested ? buildMeta(pagination.page, pagination.limit, total!) : undefined;
    sendSuccess(res, 200, `${entityName} list fetched`, data, meta);
  });

  const getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await model.findById(req.params.id);
    if (!item) throw ApiError.notFound(`${entityName} not found`);
    const data = sensitiveFields.length
      ? revealSensitiveFields(item.toObject(), sensitiveFields)
      : item;
    sendSuccess(res, 200, `${entityName} fetched`, data);
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const item = await model.create(req.body);
    sendSuccess(res, 201, `${entityName} created`, item);
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const item = await model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) throw ApiError.notFound(`${entityName} not found`);
    sendSuccess(res, 200, `${entityName} updated`, item);
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    const item = await model.findByIdAndDelete(req.params.id);
    if (!item) throw ApiError.notFound(`${entityName} not found`);
    sendSuccess(res, 200, `${entityName} deleted`, item);
  });

  return { list, getById, create, update, remove };
}

/**
 * Mounts the read (list/getById) and delete admin routes under /admin/*, gated behind the passed
 * middlewares. Create/update are intentionally left out — mount those per-module with their own
 * zod validation schema, e.g. router.post("/admin", ...guards, validate(schema), handlers.create).
 */
export function mountAdminCrudRoutes(
  router: Router,
  handlers: ReturnType<typeof buildAdminCrudHandlers>,
  guards: RequestHandler[]
): void {
  router.get("/admin", ...guards, handlers.list);
  router.get("/admin/:id", ...guards, handlers.getById);
  router.delete("/admin/:id", ...guards, handlers.remove);
}
