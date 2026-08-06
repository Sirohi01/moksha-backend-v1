import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as auditService from "./audit.service";

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, action, userId, from, to, limit, page } = req.query as unknown as {
    entityType?: string;
    action?: string;
    userId?: string;
    from?: Date;
    to?: Date;
    limit: number;
    page?: number;
  };
  const { logs, meta } = await auditService.listAuditLogs({ entityType, action, userId, from, to, limit, page });
  sendSuccess(res, 200, "Audit logs fetched", logs, meta);
});

export const listAuditActionTypes = asyncHandler(async (_req: Request, res: Response) => {
  const actions = await auditService.listAuditActionTypes();
  sendSuccess(res, 200, "Audit action types fetched", actions);
});

export const listAuditEntityTypes = asyncHandler(async (_req: Request, res: Response) => {
  const entityTypes = await auditService.listAuditEntityTypes();
  sendSuccess(res, 200, "Audit entity types fetched", entityTypes);
});
