import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { buildDashboardOverview, getIndexCoverageSnapshot, getPageSpeedReadySnapshot, getSiteStatusSnapshot } from "./dashboard.service";

export const getDashboardOverview = asyncHandler(async (_req: Request, res: Response) => {
  const dashboard = await buildDashboardOverview();
  sendSuccess(res, 200, "Dashboard overview fetched", dashboard);
});

export const getPageSpeedStatus = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "PageSpeed status fetched", await getPageSpeedReadySnapshot());
});

export const getIndexCoverageStatus = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "Index coverage status fetched", getIndexCoverageSnapshot());
});

export const getSiteStatus = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "Site status fetched", getSiteStatusSnapshot());
});
