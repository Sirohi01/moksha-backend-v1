import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoAgsDelegate.controller";
import { createAgsDelegateSchema, listAgsDelegatesSchema, updateAgsDelegateSchema } from "./namoAgsDelegate.validation";

const router = Router();
// AGS delegate records are staff/coordinator-entered CRM leads, not a public registration form
// (the legacy admin's AGSAddData.jsx is a manual-entry screen used by coordinators, with no
// evidence anywhere in the audited public site or backend of an unauthenticated intake path) —
// unlike Members/Jobs/Volunteers, there is no public POST here.
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "NAMOGANGE" })];

router.get("/admin", ...scoped("agsDelegates.read"), validate(listAgsDelegatesSchema), controller.list);
router.get("/admin/:id", ...scoped("agsDelegates.read"), controller.get);
router.post("/admin", ...scoped("agsDelegates.create"), validate(createAgsDelegateSchema), controller.create);
router.put("/admin/:id", ...scoped("agsDelegates.update"), validate(updateAgsDelegateSchema), controller.update);
router.delete("/admin/:id", ...scoped("agsDelegates.delete"), controller.remove);

export default router;
