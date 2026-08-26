import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { Organisation } from "../../models/organisation.model";
import * as service from "./arogyaCoupon.service";

async function publicOrgId() {
  const organisation = await Organisation.findOne({ code: "AROGYA", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Arogya organisation is not configured");
  return organisation._id.toString();
}
const scopeId = (req: Request) => {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
};

export const validatePublic = asyncHandler(async (req: Request, res: Response) => {
  const { code, registrationType } = req.body as { code: string; registrationType?: "single" | "group" };
  sendSuccess(res, 200, "Coupon validated", await service.validateForDisplay(await publicOrgId(), code, registrationType));
});
export const listAdmin = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Coupons fetched", await service.list(scopeId(req), req.query.status as string | undefined))
);
export const create = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 201, "Coupon created", await service.create(scopeId(req), req.body))
);
export const update = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Coupon updated", await service.update(scopeId(req), req.params.id, req.body))
);
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(scopeId(req), req.params.id);
  sendSuccess(res, 200, "Coupon deleted", null);
});
