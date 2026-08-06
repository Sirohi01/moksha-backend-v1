import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as authController from "./auth.controller";
import {
  changePasswordSchema,
  confirmTwoFactorSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from "./auth.validation";

const router = Router();
router.post("/otp/send", validate(sendOtpSchema), authController.sendOtp);
router.post("/otp/verify", validate(verifyOtpSchema), authController.verifyOtp);
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh-token", validate(refreshTokenSchema), authController.refreshToken);
router.post("/logout", validate(refreshTokenSchema), authController.logout);

router.get("/me", requireAuth, authController.getMe);
router.patch("/change-password", requireAuth, validate(changePasswordSchema), authController.changePassword);
router.get("/sessions", requireAuth, authController.getSessions);
router.delete("/sessions/:id", requireAuth, authController.revokeSession);

// requireAuth only (not authorize) — a user mid-2FA-enrollment must still reach these two routes.
router.post("/2fa/setup", requireAuth, authController.startTwoFactorSetup);
router.post("/2fa/confirm", requireAuth, validate(confirmTwoFactorSchema), authController.confirmTwoFactorSetup);

export default router;
