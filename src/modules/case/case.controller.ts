import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { parsePagination } from "../../utils/pagination";
import * as caseService from "./case.service";
import { CasePriority, CaseStatus } from "../../utils/constants";

export const listCasesAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status, city, priority } = req.query as {
    status?: CaseStatus;
    city?: string;
    priority?: CasePriority;
  };
  const pagination = parsePagination(req);
  const { cases, meta } = await caseService.listCasesForAdmin({ status, city, priority }, pagination);
  sendSuccess(res, 200, "Cases fetched", cases, meta);
});

export const getCaseAdmin = asyncHandler(async (req: Request, res: Response) => {
  const kase = await caseService.getCaseForAdmin(req.params.id);
  sendSuccess(res, 200, "Case fetched", kase);
});

export const transitionStatus = asyncHandler(async (req: Request, res: Response) => {
  const kase = await caseService.transitionCaseStatus(
    req.params.id,
    req.body.toStatus,
    req.auth!.userId,
    req.body.note
  );
  sendSuccess(res, 200, "Case status updated", kase);
});

export const verifyCase = asyncHandler(async (req: Request, res: Response) => {
  const kase = await caseService.verifyCase(req.params.id, req.auth!.userId, req.body);
  sendSuccess(res, 200, "Case verification recorded", kase);
});

export const assignCaseManager = asyncHandler(async (req: Request, res: Response) => {
  const kase = await caseService.assignCaseManager(req.params.id, req.body.caseManagerId, req.auth!.userId);
  sendSuccess(res, 200, "Case manager assigned", kase);
});

export const assignVolunteer = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await caseService.assignVolunteer(req.params.id, req.body, req.auth!.userId);
  sendSuccess(res, 201, "Volunteer assigned", assignment);
});

export const addDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const document = await caseService.addCaseDocument(
    req.params.id,
    req.file,
    req.body.docType,
    req.body.isProof,
    req.auth!.userId
  );
  sendSuccess(res, 201, "Document uploaded", document);
});

export const addExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await caseService.addCaseExpense(req.params.id, req.body, req.auth!.userId);
  sendSuccess(res, 201, "Expense submitted", expense);
});

export const decideExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await caseService.decideCaseExpense(
    req.params.expenseId,
    req.body.decision,
    req.auth!.userId,
    req.body.remark
  );
  sendSuccess(res, 200, "Expense decision recorded", expense);
});

export const trackCase = asyncHandler(async (req: Request, res: Response) => {
  const { caseId, phone } = req.query as { caseId: string; phone: string };
  const result = await caseService.trackCase(caseId, phone);
  sendSuccess(res, 200, "Case status fetched", result);
});

export const cancelCase = asyncHandler(async (req: Request, res: Response) => {
  const kase = await caseService.cancelCase(req.params.id, req.auth!.userId, req.body.reason);
  sendSuccess(res, 200, "Case cancelled", kase);
});

export const withdrawVolunteerAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await caseService.withdrawVolunteerAssignment(
    req.params.id,
    req.params.assignmentId,
    req.auth!.userId,
    req.body.reason
  );
  sendSuccess(res, 200, "Assignment withdrawn", assignment);
});

export const getSlaBreaches = asyncHandler(async (_req: Request, res: Response) => {
  const breaches = await caseService.listSlaBreaches();
  sendSuccess(res, 200, "SLA breaches fetched", breaches);
});

export const getCaseSummary = asyncHandler(async (req: Request, res: Response) => {
  const html = await caseService.renderCaseSummaryHtml(req.params.id);
  res.type("html").send(html);
});
