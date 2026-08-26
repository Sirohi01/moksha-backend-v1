import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as organisationService from "./organisation.service";
import { OrganisationStatus } from "../../utils/constants";

export const listOrganisations = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as { status?: OrganisationStatus };
  const organisations = await organisationService.listOrganisations({ status });
  sendSuccess(res, 200, "Organisations fetched", organisations);
});

export const getOrganisation = asyncHandler(async (req: Request, res: Response) => {
  const organisation = await organisationService.getOrganisationById(req.params.id);
  sendSuccess(res, 200, "Organisation fetched", organisation);
});

export const createOrganisation = asyncHandler(async (req: Request, res: Response) => {
  const organisation = await organisationService.createOrganisation(req.body);
  sendSuccess(res, 201, "Organisation created", organisation);
});

export const updateOrganisation = asyncHandler(async (req: Request, res: Response) => {
  const organisation = await organisationService.updateOrganisation(req.params.id, req.body);
  sendSuccess(res, 200, "Organisation updated", organisation);
});
