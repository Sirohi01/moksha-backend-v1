import { Router } from "express";
import { getRedirects, createRedirect, updateRedirect, deleteRedirect } from "./redirect.controller";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";

const router = Router();

// Public route to get redirects for the middleware (can also be internal/restricted if using a secret)
router.get("/", getRedirects);

// Admin only routes
const adminGuards = [requireAuth, authorize("settings.update")];

router.post("/", ...adminGuards, createRedirect);
router.patch("/:id", ...adminGuards, updateRedirect);
router.delete("/:id", ...adminGuards, deleteRedirect);

export default router;
