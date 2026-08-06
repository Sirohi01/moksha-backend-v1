import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as partnerService from "./partner.service";
import { PartnerType, PartnerStatus } from "../../utils/constants";

export const listPartners = asyncHandler(async (req: Request, res: Response) => {
  const { type, status } = req.query as { type?: PartnerType; status?: PartnerStatus };
  const partners = await partnerService.listPartners({ type, status });
  sendSuccess(res, 200, "Partners fetched", partners);
});

export const getPartner = asyncHandler(async (req: Request, res: Response) => {
  const partner = await partnerService.getPartnerById(req.params.id);
  sendSuccess(res, 200, "Partner fetched", partner);
});

export const createPartner = asyncHandler(async (req: Request, res: Response) => {
  const partner = await partnerService.createPartner(req.body);
  sendSuccess(res, 201, "Partner created", partner);
});

export const updatePartner = asyncHandler(async (req: Request, res: Response) => {
  const partner = await partnerService.updatePartner(req.params.id, req.body);
  sendSuccess(res, 200, "Partner updated", partner);
});
