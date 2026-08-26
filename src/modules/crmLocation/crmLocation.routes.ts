import { Router } from "express";
import { CrmCountry, CrmState, CrmCity } from "../../models/crmLocation.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";

const router = Router();

// Shared, read-only reference data (see crmLocation.model.ts) — no admin write surface exists
// here on purpose; these are managed by re-running the import script, not hand-edited one at a
// time. Public because every organisation's registration form needs to read them unauthenticated.
router.get(
  "/countries",
  asyncHandler(async (_req, res) => sendSuccess(res, 200, "Countries fetched", await CrmCountry.find().sort({ name: 1 })))
);
router.get(
  "/states",
  asyncHandler(async (req, res) => {
    const countryCode = req.query.countryCode ? Number(req.query.countryCode) : undefined;
    const filter = countryCode !== undefined && !Number.isNaN(countryCode) ? { countryCode } : {};
    sendSuccess(res, 200, "States fetched", await CrmState.find(filter).sort({ name: 1 }));
  })
);
router.get(
  "/cities",
  asyncHandler(async (req, res) => {
    const stateCode = req.query.stateCode ? Number(req.query.stateCode) : undefined;
    const filter = stateCode !== undefined && !Number.isNaN(stateCode) ? { stateCode } : {};
    sendSuccess(res, 200, "Cities fetched", await CrmCity.find(filter).sort({ name: 1 }));
  })
);

export default router;
