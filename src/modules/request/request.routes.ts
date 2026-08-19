import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { publicFormLimiter } from "../../middlewares/rateLimiters";
import * as requestController from "./request.controller";
import {
  createRequestSchema,
  listRequestsQuerySchema,
  updateRequestSchema,
} from "./request.validation";
import { convertRequestSchema } from "../case/case.validation";

const router = Router();

// Public — a family in crisis submits this with no login
router.post("/", publicFormLimiter, validate(createRequestSchema), requestController.createRequest);

// Admin
router.get(
  "/admin",
  requireAuth,
  authorize("requests.read"),
  validate(listRequestsQuerySchema),
  requestController.listRequestsAdmin
);
router.get("/admin/:id", requireAuth, authorize("requests.read"), requestController.getRequestAdmin);
router.put(
  "/admin/:id",
  requireAuth,
  authorize("requests.update"),
  validate(updateRequestSchema),
  requestController.updateRequestAdmin
);
router.put(
  "/admin/:id/reject",
  requireAuth,
  authorize("requests.update"),
  requestController.rejectRequestAdmin
);
router.post(
  "/admin/:id/convert",
  requireAuth,
  authorize("cases.create"),
  validate(convertRequestSchema),
  requestController.convertRequestToCase
);

export default router;
