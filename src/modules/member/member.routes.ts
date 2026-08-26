import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./member.controller";
import { createMemberApplicationSchema, listMembersSchema, updateMemberSchema } from "./member.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "NAMOGANGE" })];
router.post("/apply", validate(createMemberApplicationSchema), controller.apply);
router.get("/admin", ...scoped("members.read"), validate(listMembersSchema), controller.list);
router.get("/admin/:id", ...scoped("members.read"), controller.get);
router.put("/admin/:id", ...scoped("members.update"), validate(updateMemberSchema), controller.update);
export default router;
