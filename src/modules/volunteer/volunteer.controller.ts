import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as volunteerService from "./volunteer.service";
import { parsePagination } from "../../utils/pagination";
import { VolunteerStatus } from "../../utils/constants";

export const registerVolunteer = asyncHandler(async (req: Request, res: Response) => {
  const result = await volunteerService.registerVolunteer(req.body, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  sendSuccess(res, 201, "Welcome to the Moksha Sewa volunteer team", {
    user: { id: result.user._id, name: result.user.name, phone: result.user.phone, email: result.user.email },
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

export const updateVolunteerStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.updateVolunteerStatus(req.params.id, req.body.status, req.auth!.userId);
  sendSuccess(res, 200, "Volunteer status updated", volunteer);
});

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.getMyProfile(req.auth!.userId);
  sendSuccess(res, 200, "Profile fetched", volunteer);
});

export const updateMyAvailability = asyncHandler(async (req: Request, res: Response) => {
  const volunteer = await volunteerService.updateMyAvailability(req.auth!.userId, req.body.availability);
  sendSuccess(res, 200, "Availability updated", volunteer);
});

export const listMyAssignments = asyncHandler(async (req: Request, res: Response) => {
  const assignments = await volunteerService.listMyAssignments(req.auth!.userId);
  sendSuccess(res, 200, "Assignments fetched", assignments);
});

export const respondToAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await volunteerService.respondToAssignment(
    req.auth!.userId,
    req.params.assignmentId,
    req.body.response
  );
  sendSuccess(res, 200, "Response recorded", assignment);
});
