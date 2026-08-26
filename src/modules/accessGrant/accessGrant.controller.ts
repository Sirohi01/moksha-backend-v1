import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import * as accessGrantService from "./accessGrant.service";

export const listAccessGrants = asyncHandler(async (req: Request, res: Response) => {
  const { userId, organisationId, status } = req.query as {
    userId?: string;
    organisationId?: string;
    status?: string;
  };
  const grants = await accessGrantService.listAccessGrants({ userId, organisationId, status });
  sendSuccess(res, 200, "Access grants fetched", grants);
});

export const getAccessGrant = asyncHandler(async (req: Request, res: Response) => {
  const grant = await accessGrantService.getAccessGrantById(req.params.id);
  sendSuccess(res, 200, "Access grant fetched", grant);
});

export const createAccessGrant = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();
  const grant = await accessGrantService.createAccessGrant(req.body, req.auth.userId);
  sendSuccess(res, 201, "Access grant created", grant);
});

export const updateAccessGrantExpiry = asyncHandler(async (req: Request, res: Response) => {
  const grant = await accessGrantService.updateAccessGrantExpiry(req.params.id, req.body.expiresAt);
  sendSuccess(res, 200, "Access grant updated", grant);
});

export const revokeAccessGrant = asyncHandler(async (req: Request, res: Response) => {
  const grant = await accessGrantService.revokeAccessGrant(req.params.id);
  sendSuccess(res, 200, "Access grant revoked", grant);
});
