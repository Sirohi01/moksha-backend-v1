import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as auditController from "./audit.controller";
import { listAuditLogsQuerySchema } from "./audit.validation";

const router = Router();
const guards = [requireAuth, authorize("audit.read")];

router.get("/admin", ...guards, validate(listAuditLogsQuerySchema), auditController.listAuditLogs);
router.get("/admin/actions", ...guards, auditController.listAuditActionTypes);
router.get("/admin/entity-types", ...guards, auditController.listAuditEntityTypes);

export default router;
