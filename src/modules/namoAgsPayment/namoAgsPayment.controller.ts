import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import * as service from "./namoAgsPayment.service";

const scopeId = (req: Request) => {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
};
const userId = (req: Request) => {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth.userId;
};

export const create = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 201, "Payment recorded", await service.createPayment(scopeId(req), req.body, userId(req)))
);

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { agsDelegateId, status } = req.query as { agsDelegateId?: string; status?: string };
  sendSuccess(res, 200, "Payments fetched", await service.listPayments(scopeId(req), { agsDelegateId, status }));
});

export const get = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Payment fetched", await service.getPayment(scopeId(req), req.params.id))
);

export const update = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Payment updated", await service.updatePayment(scopeId(req), req.params.id, req.body, userId(req)))
);

export const cancel = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Payment cancelled", await service.cancelPayment(scopeId(req), req.params.id, userId(req)))
);
