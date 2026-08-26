import { Request, Response } from "express";
import { NamoVolunteerStatus } from "../../models/namoVolunteer.model";
import { Organisation } from "../../models/organisation.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import * as service from "./namoVolunteer.service";
async function namoId() { const org = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" }).select("_id"); if (!org) throw ApiError.notFound("Namo Gange organisation is not configured"); return org._id.toString(); }
function scopeId(req: Request) { if (!req.scope) throw ApiError.forbidden("Organisation scope is required"); return req.scope.organisationId; }
export const apply = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 201, "Volunteer application received", await service.apply(await namoId(), req.body)));
export const list = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Volunteers fetched", await service.list(scopeId(req), req.query.status as NamoVolunteerStatus | undefined)));
export const get = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Volunteer fetched", await service.get(scopeId(req), req.params.id)));
export const update = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, 200, "Volunteer updated", await service.update(scopeId(req), req.params.id, req.body)));
