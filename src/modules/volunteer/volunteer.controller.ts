import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import * as volunteerService from "./volunteer.service";
import { parsePagination } from "../../utils/pagination";
import { VolunteerStatus } from "../../utils/constants";
import { uploadBuffer } from "../../lib/cloudinary";

export const registerVolunteer = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const [photograph, idProof] = await Promise.all([
    uploadBuffer(files.photograph[0].buffer, "moksha-sewa/volunteers/photographs"),
    uploadBuffer(files.idProof[0].buffer, "moksha-sewa/volunteers/id-proofs"),
  ]);
  const result = await volunteerService.registerVolunteer({ ...req.body, photographUrl: photograph.url, photographPublicId: photograph.publicId, idProofUrl: idProof.url, idProofPublicId: idProof.publicId }, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  sendSuccess(res, 201, "Welcome to the Moksha Sewa volunteer team", {
    user: {
      id: result.user._id,
      name: result.user.name,
      phone: result.user.phone,
      email: result.user.email,
      userType: result.user.userType,
    },
    volunteer: result.volunteer,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
});

export const listVolunteersAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status, city } = req.query as { status?: VolunteerStatus; city?: string };
  const pagination = parsePagination(req);
  const { volunteers, meta } = await volunteerService.listVolunteersForAdmin({ status, city }, pagination);
  sendSuccess(res, 200, "Volunteers fetched", volunteers, meta);
});

export const getVolunteerAdmin = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.getVolunteerForAdmin(req.params.id);
  sendSuccess(res, 200, "Volunteer fetched", volunteer);
});

export const printVolunteerAdmin = asyncHandler(async (req: Request, res: Response) => {
  const html = await volunteerService.getVolunteerPrintHtml(req.params.id);
  res.type("html").send(html);
});

export const downloadVolunteerPdfAdmin = asyncHandler(async (req: Request, res: Response) => {
  const pdf = await volunteerService.getVolunteerPdf(req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="moksha-sewa-volunteer-${req.params.id}.pdf"`);
  res.send(pdf);
});

export const updateVolunteerStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.updateVolunteerStatus(req.params.id, req.body.status, req.auth!.userId);
  sendSuccess(res, 200, "Volunteer status updated", volunteer);
});

export const updateVolunteerOfficeUseAdmin = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.updateVolunteerOfficeUse(req.params.id, req.body, req.auth!.userId);
  sendSuccess(res, 200, "Volunteer record updated", volunteer);
});

export const deleteVolunteerAdmin = asyncHandler(async (req: Request, res: Response) => {
  await volunteerService.deleteVolunteer(req.params.id, req.auth!.userId);
  sendSuccess(res, 200, "Volunteer deleted", null);
});

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.getMyProfile(req.auth!.userId);
  sendSuccess(res, 200, "Profile fetched", volunteer);
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.updateMyVolunteerProfile(req.auth!.userId, req.body);
  sendSuccess(res, 200, "Profile updated", volunteer);
});

export const updateMyAvailability = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.updateMyAvailability(req.auth!.userId, req.body.availability);
  sendSuccess(res, 200, "Availability updated", volunteer);
});

export const listMyAssignments = asyncHandler(async (req: Request, res: Response) => {
  const assignments = await volunteerService.listMyAssignments(req.auth!.userId);
  sendSuccess(res, 200, "Assignments fetched", assignments);
});

export const getMyAssignmentDetail = asyncHandler(async (req: Request, res: Response) => {
  const detail = await volunteerService.getMyAssignmentDetail(req.auth!.userId, req.params.assignmentId);
  sendSuccess(res, 200, "Assignment detail fetched", detail);
});

export const uploadAssignmentDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const document = await volunteerService.uploadAssignmentDocument(
    req.auth!.userId,
    req.params.assignmentId,
    req.file,
    req.body.docType,
    req.body.isProof
  );
  sendSuccess(res, 201, "Document uploaded", document);
});

export const respondToAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await volunteerService.respondToAssignment(
    req.auth!.userId,
    req.params.assignmentId,
    req.body.response
  );
  sendSuccess(res, 200, "Response recorded", assignment);
});
