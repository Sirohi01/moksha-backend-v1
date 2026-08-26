import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { ArogyaPassApplicableTo } from "../../models/arogyaPass.model";
import { Organisation } from "../../models/organisation.model";
import * as service from "./arogyaPass.service";

async function publicOrgId() {
  const organisation = await Organisation.findOne({ code: "AROGYA", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Arogya organisation is not configured");
  return organisation._id.toString();
}
const scopeId = (req: Request) => {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
};
const listOpts = (req: Request) => ({
  all: req.query.all as unknown as boolean | undefined,
  type: req.query.type as ArogyaPassApplicableTo | undefined,
});

export const listPublic = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Passes fetched", await service.listPublic(await publicOrgId(), listOpts(req)))
);
export const listAdmin = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Passes fetched", await service.listPublic(scopeId(req), listOpts(req)))
);
export const create = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 201, "Pass created", await service.create(scopeId(req), req.body))
);
export const update = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Pass updated", await service.update(scopeId(req), req.params.id, req.body))
);
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(scopeId(req), req.params.id);
  sendSuccess(res, 200, "Pass deleted", null);
});
