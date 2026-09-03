import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { isGrantValid } from "./systemServiceAccess.service";

export const requireSystemServiceAccess = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!(await isGrantValid(req))) {
    return next(ApiError.forbidden("System & Security access approval is required or has expired"));
  }
  next();
});
