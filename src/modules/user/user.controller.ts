import { Request, Response } from "express";
import { User, IUser } from "../../models/user.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { decryptField, maybeDecrypt } from "../../lib/crypto";
import * as userService from "./user.service";

/** Decrypts a user's address for display. `reveal` is decryptField (owner-view, always) or
 * maybeDecrypt (admin-view, gated by EXPOSE_DECRYPTED_DATA). */
function serializeUser(user: IUser, reveal: (v: string) => string) {
  const obj = user.toObject();
  obj.addresses = obj.addresses.map((address: IUser["addresses"][number]) => ({
    ...address,
    line1: reveal(address.line1),
  }));
  return obj;
}

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();
  const user = await User.findById(req.auth.userId);
  if (!user) throw ApiError.notFound("User not found");
  sendSuccess(res, 200, "Profile fetched", {
    ...serializeUser(user, decryptField),
    roleSlug: req.auth.roleSlug,
    permissions: Array.from(req.auth.permissions),
  });
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();

  // Fetch-then-save (not findByIdAndUpdate) so the addresses encryption hook in user.model.ts
  // actually runs — that hook only fires on doc.save(), same documented constraint as every other
  // encrypted field in this codebase.
  const user = await User.findById(req.auth.userId);
  if (!user) throw ApiError.notFound("User not found");

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.email !== undefined) user.email = req.body.email;
  if (req.body.addresses !== undefined) user.addresses = req.body.addresses;

  await user.save();
  sendSuccess(res, 200, "Profile updated", serializeUser(user, decryptField));
});

export const listCustomersAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find({ userType: "DONOR" }).sort({ createdAt: -1 });
  // Admin viewing other people's PII — gated by the EXPOSE_DECRYPTED_DATA toggle.
  sendSuccess(res, 200, "Customers fetched", users.map((user) => serializeUser(user, maybeDecrypt)));
});

export const inviteStaff = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.inviteStaff(req.body, req.auth!.userId);
  sendSuccess(res, 201, "Staff account created", result);
});

export const listStaff = asyncHandler(async (_req: Request, res: Response) => {
  const staff = await userService.listStaff();
  sendSuccess(res, 200, "Staff fetched", staff);
});

export const updateStaffStatus = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.updateStaffStatus(req.params.id, req.body.status, req.auth!.userId);
  sendSuccess(res, 200, "Staff status updated", staff);
});

export const updateStaffDetails = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.updateStaffDetails(req.params.id, req.body, req.auth!.userId);
  sendSuccess(res, 200, "Staff account updated", staff);
});

export const updateStaffRole = asyncHandler(async (req: Request, res: Response) => {
  const staff = await userService.updateStaffRole(req.params.id, req.body.roleId, req.auth!.userId);
  sendSuccess(res, 200, "Staff role updated", staff);
});
