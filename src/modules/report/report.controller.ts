import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as reportService from "./report.service";

export const getOverview = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await reportService.getOverview();
  sendSuccess(res, 200, "Overview fetched", overview);
});

export const exportCasesCsv = asyncHandler(async (_req: Request, res: Response) => {
  const csv = await reportService.exportCasesCsv();
  res.type("text/csv").attachment(`cases-${Date.now()}.csv`).send(csv);
});

export const exportDonationsCsv = asyncHandler(async (_req: Request, res: Response) => {
  const csv = await reportService.exportDonationsCsv();
  res.type("text/csv").attachment(`donations-${Date.now()}.csv`).send(csv);
});

export const getSnapshots = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(String(req.query.days ?? "30"), 10) || 30));
  const snapshots = await reportService.listSnapshots(days);
  sendSuccess(res, 200, "Snapshots fetched", snapshots);
});

export const getPublicImpact = asyncHandler(async (_req: Request, res: Response) => {
  const impact = await reportService.getPublicImpact();
  sendSuccess(res, 200, "Impact numbers fetched", impact);
});
