import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as campaignService from "./campaign.service";
import { CampaignStatus } from "../../utils/constants";

export const listPublicCampaigns = asyncHandler(async (_req: Request, res: Response) => {
  const campaigns = await campaignService.listPublicCampaigns();
  sendSuccess(res, 200, "Campaigns fetched", campaigns);
});

export const listCampaignsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as { status?: CampaignStatus };
  const campaigns = await campaignService.listCampaignsForAdmin({ status });
  sendSuccess(res, 200, "Campaigns fetched", campaigns);
});

export const getCampaignAdmin = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.getCampaignById(req.params.id);
  sendSuccess(res, 200, "Campaign fetched", campaign);
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.createCampaign(req.body, req.auth!.userId);
  sendSuccess(res, 201, "Campaign created", campaign);
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.updateCampaign(req.params.id, req.body);
  sendSuccess(res, 200, "Campaign updated", campaign);
});
