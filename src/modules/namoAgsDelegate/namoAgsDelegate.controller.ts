import { Request, Response } from "express";
import { AgsClientStatus, AgsDelegateStatus } from "../../models/namoAgsDelegate.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import * as service from "./namoAgsDelegate.service";

const scopeId = (req: Request) => {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
};
const userId = (req: Request) => {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth.userId;
};

export const create = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 201, "Delegate created", await service.createDelegate(scopeId(req), req.body, userId(req)))
);

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { status, clientStatus, search } = req.query as {
    status?: AgsDelegateStatus;
    clientStatus?: AgsClientStatus;
    search?: string;
  };
  sendSuccess(res, 200, "Delegates fetched", await service.listDelegates(scopeId(req), { status, clientStatus, search }));
});

export const get = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Delegate fetched", await service.getDelegate(scopeId(req), req.params.id))
);

export const update = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Delegate updated", await service.updateDelegate(scopeId(req), req.params.id, req.body, userId(req)))
);

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteDelegate(scopeId(req), req.params.id, userId(req));
  sendSuccess(res, 200, "Delegate deleted", null);
});
