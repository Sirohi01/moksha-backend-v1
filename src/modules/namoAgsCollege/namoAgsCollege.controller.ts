import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import * as service from "./namoAgsCollege.service";

const scopeId = (req: Request) => {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
};

export const list = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await service.list(scopeId(req)) })
);
export const create = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json({ success: true, data: await service.create(scopeId(req), req.body) })
);
export const update = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await service.update(scopeId(req), req.params.id, req.body) })
);
export const remove = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await service.remove(scopeId(req), req.params.id) })
);
