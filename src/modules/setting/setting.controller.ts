import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as settingService from "./setting.service";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingService.getSettings();
  sendSuccess(res, 200, "Settings fetched", settings);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingService.updateSettings(req.body);
  sendSuccess(res, 200, "Settings updated", settings);
});
