import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoAgsPayment.controller";
import { createAgsPaymentSchema, listAgsPaymentsSchema, updateAgsPaymentSchema } from "./namoAgsPayment.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "NAMOGANGE" })];

router.get("/admin", ...scoped("agsPayments.read"), validate(listAgsPaymentsSchema), controller.list);
router.get("/admin/:id", ...scoped("agsPayments.read"), controller.get);
router.post("/admin", ...scoped("agsPayments.create"), validate(createAgsPaymentSchema), controller.create);
router.put("/admin/:id", ...scoped("agsPayments.update"), validate(updateAgsPaymentSchema), controller.update);
router.put("/admin/:id/cancel", ...scoped("agsPayments.update"), controller.cancel);

export default router;
