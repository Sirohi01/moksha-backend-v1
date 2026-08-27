import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { Organisation } from "../../models/organisation.model";
import * as service from "./namoDonationLead.service";

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
  const { SewaType, ...rest } = req.body as Record<string, unknown> & { SewaType: string };
  const entry = await service.create(await orgId(), { ...rest, sewaType: SewaType } as Parameters<typeof service.create>[1]);
  res.status(201).json({ success: true, message: "Donation pledge received successfully", data: entry });
});

export const listAdmin = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await service.listAdmin(scopeId(req)) })
);
