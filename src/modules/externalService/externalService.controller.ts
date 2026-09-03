import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { ExternalService, IExternalService } from "../../models/externalService.model";
import { decryptField } from "../../lib/crypto";
import { writeAuditLog } from "../../lib/audit.service";
import { createGrant, getRequirements, getValidGrant } from "./systemServiceAccess.service";
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
  // Passwords/API secrets are never returned in a bulk response. A specific record can only be
  // revealed after the independently enforced step-up gate.
  sendSuccess(res, 200, "External services fetched", items.map((item) => {
    const obj = item.toObject() as unknown as Record<string, unknown>;
    delete obj.secretValue;
    return obj;
  }));
});

export const summary = asyncHandler(async (_req: Request, res: Response) => {
  const items = await ExternalService.find().select("name category expiryDate remindersEnabled popupReminderDays").sort({ expiryDate: 1 }).lean();
  sendSuccess(res, 200, "Service renewal summary fetched", items);
});

export const accessRequirements = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 200, "Access requirements fetched", await getRequirements(req.auth!.userId, req.auth!.roleSlug));
});

export const verifyAccess = asyncHandler(async (req: Request, res: Response) => {
  try {
    const grant = await createGrant(req, req.body?.approvals);
    await writeAuditLog({ userId: req.auth!.userId, action: "SYSTEM_SERVICES_ACCESS_GRANTED", entityType: "SystemServiceAccess", after: { expiresAt: grant.expiresAt } });
    sendSuccess(res, 200, "System & Security access granted", grant);
  } catch (error) {
    await writeAuditLog({ userId: req.auth!.userId, action: "SYSTEM_SERVICES_ACCESS_DENIED", entityType: "SystemServiceAccess", after: { ip: req.ip } });
    throw error;
  }
});

export const accessStatus = asyncHandler(async (req: Request, res: Response) => {
  const grant = await getValidGrant(req);
  if (!grant) throw ApiError.forbidden("System & Security access approval is required or has expired");
  sendSuccess(res, 200, "Access grant is valid", { valid: true, expiresAt: grant.expiresAt });
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
