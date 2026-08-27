import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoDonationLead.controller";
import { createNamoDonationLeadSchema } from "./namoDonationLead.validation";

const router = Router();

router.post("/", validate(createNamoDonationLeadSchema), controller.create);
router.get("/admin", requireAuth, authorizeScoped({ permission: "namoDonationLeads.read", organisation: "NAMOGANGE" }), controller.listAdmin);

export default router;
