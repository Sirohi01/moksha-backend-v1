import { Router } from "express";
import { Faq } from "../../models/faq.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers, mountAdminCrudRoutes } from "../../utils/crudFactory";
import * as faqController from "./faq.controller";
import { createFaqSchema, updateFaqSchema } from "./faq.validation";

const router = Router();
const adminGuards = [requireAuth, authorize("cms.update")];
const handlers = buildAdminCrudHandlers(Faq, "FAQ");

router.get("/", faqController.listPublicFaqs);

mountAdminCrudRoutes(router, handlers, adminGuards);
router.post("/admin", ...adminGuards, validate(createFaqSchema), handlers.create);
router.put("/admin/:id", ...adminGuards, validate(updateFaqSchema), handlers.update);

export default router;
