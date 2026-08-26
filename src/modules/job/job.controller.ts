import { Request, Response } from "express";
import { Organisation } from "../../models/organisation.model";
import { JobStatus } from "../../models/job.model";
import { writeAuditLog } from "../../lib/audit.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import * as service from "./job.service";

async function namoOrganisationId(): Promise<string> {
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Namo Gange organisation is not configured");
  return organisation._id.toString();
}

function scopedOrganisationId(req: Request): string {
  if (!req.scope?.organisationId) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
}

export const listPublic = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "Jobs fetched", await service.listPublicJobs(await namoOrganisationId()));
});

export const getPublic = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 200, "Job fetched", await service.getPublicJob(await namoOrganisationId(), req.params.slug));
});

export const listAdmin = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 200, "Jobs fetched", await service.listAdminJobs(scopedOrganisationId(req), req.query.status as JobStatus | undefined));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const job = await service.createJob(scopedOrganisationId(req), req.body);
  void writeAuditLog({ userId: req.auth?.userId, action: "job.created", entityType: "Job", entityId: job._id.toString(), after: job.toObject() });
  sendSuccess(res, 201, "Job created", job);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const job = await service.updateJob(scopedOrganisationId(req), req.params.id, req.body);
  void writeAuditLog({ userId: req.auth?.userId, action: "job.updated", entityType: "Job", entityId: job._id.toString(), after: job.toObject() });
  sendSuccess(res, 200, "Job updated", job);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const job = await service.deleteJob(scopedOrganisationId(req), req.params.id);
  void writeAuditLog({ userId: req.auth?.userId, action: "job.deleted", entityType: "Job", entityId: job._id.toString(), before: job.toObject() });
  sendSuccess(res, 200, "Job deleted", job);
});
