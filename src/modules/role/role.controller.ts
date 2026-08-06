import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as roleService from "./role.service";

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await roleService.listRoles();
  sendSuccess(res, 200, "Roles fetched", roles);
});

export const getRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleService.getRoleById(req.params.id);
  sendSuccess(res, 200, "Role fetched", role);
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleService.createRole(req.body);
  sendSuccess(res, 201, "Role created", role);
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleService.updateRole(req.params.id, req.body);
  sendSuccess(res, 200, "Role updated", role);
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  await roleService.deleteRole(req.params.id);
  sendSuccess(res, 200, "Role deleted", null);
});

export const listPermissions = asyncHandler(async (_req: Request, res: Response) => {
  const permissions = await roleService.listPermissions();
  sendSuccess(res, 200, "Permissions fetched", permissions);
});
