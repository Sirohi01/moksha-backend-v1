import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { buildDashboardOverview } from "./dashboard.service";

export const getDashboardOverview = asyncHandler(async (_req: Request, res: Response) => {
  const dashboard = await buildDashboardOverview();
  sendSuccess(res, 200, "Dashboard overview fetched", dashboard);
});
