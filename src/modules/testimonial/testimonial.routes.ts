import { Router } from "express";
import { Testimonial } from "../../models/testimonial.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers, mountAdminCrudRoutes } from "../../utils/crudFactory";
import * as testimonialController from "./testimonial.controller";
import { submitTestimonialSchema, updateTestimonialSchema } from "./testimonial.validation";

const router = Router();
const adminGuards = [requireAuth, authorize("cms.update")];
const handlers = buildAdminCrudHandlers(Testimonial, "Testimonial");

router.get("/", testimonialController.listApprovedTestimonials);
router.post("/", validate(submitTestimonialSchema), testimonialController.submitTestimonial);

mountAdminCrudRoutes(router, handlers, adminGuards);
router.put("/admin/:id", ...adminGuards, validate(updateTestimonialSchema), handlers.update);

export default router;
