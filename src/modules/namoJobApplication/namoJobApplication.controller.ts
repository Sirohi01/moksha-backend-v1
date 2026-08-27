import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { Organisation } from "../../models/organisation.model";
import { NamoJobApplicationStatus } from "../../models/namoJobApplication.model";
import * as service from "./namoJobApplication.service";

async function orgId(): Promise<string> {
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Namo Gange organisation is not configured");
  return organisation._id.toString();
}
const scopeId = (req: Request) => {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
};

export const create = asyncHandler(async (req: Request, res: Response) => {
  const application = await service.create(await orgId(), req.body);
  res.status(201).json({ success: true, message: "Application submitted successfully", data: application });
});

export const listAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as { status?: NamoJobApplicationStatus };
  res.json({ success: true, data: await service.listAdmin(scopeId(req), status) });
});

export const getAdmin = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await service.getAdmin(scopeId(req), req.params.id) })
);

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: NamoJobApplicationStatus };
  res.json({ success: true, data: await service.updateStatus(scopeId(req), req.params.id, status) });
});
