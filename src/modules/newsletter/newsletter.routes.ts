import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as newsletterController from "./newsletter.controller";
import { subscribeSchema } from "./newsletter.validation";

const router = Router();

router.post("/", validate(subscribeSchema), newsletterController.subscribe);
router.get("/admin", requireAuth, authorize("enquiries.read"), newsletterController.listSubscribers);

export default router;
