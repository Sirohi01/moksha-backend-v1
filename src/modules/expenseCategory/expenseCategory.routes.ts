import { Router } from "express";
import { ExpenseCategory } from "../../models/expenseCategory.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers } from "../../utils/crudFactory";
import { createExpenseCategorySchema, updateExpenseCategorySchema } from "./expenseCategory.validation";

const router = Router();
// Same split as vehicle.routes.ts / serviceProvider.routes.ts — masters.read (which
// expense-submitting roles like case_manager already have) for lookup, masters.update for
// managing the list itself.
const readGuards = [requireAuth, authorize("masters.read")];
const writeGuards = [requireAuth, authorize("masters.update")];
const handlers = buildAdminCrudHandlers(ExpenseCategory, "Expense category");

router.get("/admin", ...readGuards, handlers.list);
router.get("/admin/:id", ...readGuards, handlers.getById);
router.post("/admin", ...writeGuards, validate(createExpenseCategorySchema), handlers.create);
router.put("/admin/:id", ...writeGuards, validate(updateExpenseCategorySchema), handlers.update);
router.delete("/admin/:id", ...writeGuards, handlers.remove);

export default router;
