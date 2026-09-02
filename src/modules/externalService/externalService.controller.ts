import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { ExternalService, IExternalService } from "../../models/externalService.model";
import { decryptField } from "../../lib/crypto";

// secretValue is decrypted unconditionally here (not via the generic crudFactory's maybeDecrypt
// path) — visibility into this collection is controlled by the systemServices.read permission
// itself, not by the unrelated EXPOSE_DECRYPTED_DATA toggle that governs donor-PII exposure
// policy elsewhere. Anyone who can reach this endpoint is meant to see the real credential.
function revealSecret(item: IExternalService): Record<string, unknown> {
  const obj = item.toObject();
  if (typeof obj.secretValue === "string" && obj.secretValue.length > 0) {
    try {
      obj.secretValue = decryptField(obj.secretValue);
    } catch {
      // Not a well-formed encrypted value (e.g. legacy/empty) — leave as-is rather than 500ing.
    }
  }
  return obj;
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const items = await ExternalService.find().sort({ expiryDate: 1 });
  sendSuccess(res, 200, "External services fetched", items.map(revealSecret));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const item = await ExternalService.findById(req.params.id);
  if (!item) throw ApiError.notFound("External service not found");
  sendSuccess(res, 200, "External service fetched", revealSecret(item));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const item = await ExternalService.create(req.body);
  sendSuccess(res, 201, "External service created", revealSecret(item));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const item = await ExternalService.findById(req.params.id);
  if (!item) throw ApiError.notFound("External service not found");
  Object.assign(item, req.body);
  await item.save();
  sendSuccess(res, 200, "External service updated", revealSecret(item));
});
