import { Request, Response } from "express";
import { Organisation } from "../../models/organisation.model";
import { MemberStatus } from "../../models/member.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import * as service from "./member.service";

async function namoId() {
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Namo Gange organisation is not configured");
  return organisation._id.toString();
}
const scopeId = (req: Request) => {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
};

export const apply = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 201, "Membership application received", await service.createMember(await namoId(), req.body)));
export const list = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Members fetched", await service.listMembers(scopeId(req), req.query.status as MemberStatus | undefined)));
export const get = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Member fetched", await service.getMember(scopeId(req), req.params.id)));
export const update = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Member updated", await service.updateMember(scopeId(req), req.params.id, req.body)));
