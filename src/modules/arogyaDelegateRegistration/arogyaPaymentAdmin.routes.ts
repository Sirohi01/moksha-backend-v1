import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import * as controller from "./arogyaDelegateRegistration.controller";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "AROGYA" })];

// Reuses arogyaDelegates.read: whoever can already see delegate registrations can see the
// payments behind them — this is the only screen that shows a CREATED/FAILED order that never
// turned into a registration at all (e.g. a customer who paid but never completed checkout).
router.get("/admin", ...scoped("arogyaDelegates.read"), controller.listPaymentsAdmin);
router.get("/admin/:id", ...scoped("arogyaDelegates.read"), controller.getPaymentAdmin);

export default router;
