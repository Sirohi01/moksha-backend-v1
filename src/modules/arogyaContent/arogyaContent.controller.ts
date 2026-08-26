import { Request, Response } from "express";
import { writeAuditLog } from "../../lib/audit.service";
import { ArogyaContentKind, ArogyaContentStatus } from "../../models/arogyaContent.model";
import { Organisation } from "../../models/organisation.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import * as service from "./arogyaContent.service";

async function publicOrganisationId() {
  const organisation = await Organisation.findOne({ code: "AROGYA", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Arogya organisation is not configured");
  return organisation._id.toString();
}
function scopedOrganisationId(req: Request) {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
}

export const listPublic = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Content fetched", await service.listPublic(await publicOrganisationId(), req.params.kind as ArogyaContentKind)));
export const getPublic = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Content fetched", await service.getPublic(await publicOrganisationId(), req.params.kind as ArogyaContentKind, req.params.slug)));
export const listAdmin = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Content fetched", await service.listAdmin(scopedOrganisationId(req), req.query.kind as ArogyaContentKind | undefined, req.query.status as ArogyaContentStatus | undefined)));
export const create = asyncHandler(async (req: Request, res: Response) => {
  const entry = await service.create(scopedOrganisationId(req), req.body);
  void writeAuditLog({ userId: req.auth?.userId, action: "arogyaContent.created", entityType: "ArogyaContent", entityId: entry._id.toString(), after: entry.toObject() });
  sendSuccess(res, 201, "Content created", entry);
});
export const update = asyncHandler(async (req: Request, res: Response) => {
  const entry = await service.update(scopedOrganisationId(req), req.params.id, req.body);
  void writeAuditLog({ userId: req.auth?.userId, action: "arogyaContent.updated", entityType: "ArogyaContent", entityId: entry._id.toString(), after: entry.toObject() });
  sendSuccess(res, 200, "Content updated", entry);
});
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const entry = await service.remove(scopedOrganisationId(req), req.params.id);
  void writeAuditLog({ userId: req.auth?.userId, action: "arogyaContent.deleted", entityType: "ArogyaContent", entityId: entry._id.toString(), before: entry.toObject() });
  sendSuccess(res, 200, "Content deleted", entry);
});
