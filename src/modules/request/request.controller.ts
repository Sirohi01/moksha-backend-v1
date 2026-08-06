import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { parsePagination } from "../../utils/pagination";
import * as requestService from "./request.service";
import * as caseService from "../case/case.service";
import { AssistanceRequestStatus, RequestType } from "../../utils/constants";

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await requestService.createRequest(req.body);
  sendSuccess(res, 201, "Your request has been received. Our team will reach out shortly.", request);
});

export const listRequestsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status, type } = req.query as { status?: AssistanceRequestStatus; type?: RequestType };
  const pagination = parsePagination(req);
  const { requests, meta } = await requestService.listRequestsForAdmin({ status, type }, pagination);
  sendSuccess(res, 200, "Requests fetched", requests, meta);
});

export const getRequestAdmin = asyncHandler(async (req: Request, res: Response) => {
  const request = await requestService.getRequestForAdmin(req.params.id);
  sendSuccess(res, 200, "Request fetched", request);
});

export const updateRequestAdmin = asyncHandler(async (req: Request, res: Response) => {
  const request = await requestService.updateRequest(req.params.id, req.body);
  sendSuccess(res, 200, "Request updated", request);
});

export const rejectRequestAdmin = asyncHandler(async (req: Request, res: Response) => {
  const request = await requestService.rejectRequest(req.params.id, req.auth!.userId);
  sendSuccess(res, 200, "Request rejected", request);
});

export const convertRequestToCase = asyncHandler(async (req: Request, res: Response) => {
  const kase = await caseService.convertRequestToCase(req.params.id, req.auth!.userId, req.body.priority);
  sendSuccess(res, 201, "Case created", kase);
});
