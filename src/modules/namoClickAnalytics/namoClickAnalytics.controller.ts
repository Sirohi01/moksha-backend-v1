import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { Organisation } from "../../models/organisation.model";
import * as service from "./namoClickAnalytics.service";

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
  const { iconName } = req.body as { iconName: string };
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  await service.create(await orgId(), iconName, ipAddress);
  res.status(201).json({ success: true, message: "Click recorded" });
});

export const listAdmin = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await service.getStats(scopeId(req)) })
);
