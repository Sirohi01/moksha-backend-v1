import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoOtp.controller";
import { sendEmailOtpSchema, sendMobileOtpSchema, verifyOtpSchema } from "./namoOtp.validation";

const router = Router();

router.post("/send-mobile-otp", validate(sendMobileOtpSchema), controller.sendMobileOtp);
router.post("/send-email-otp", validate(sendEmailOtpSchema), controller.sendEmailOtp);
router.post("/verify-otp", validate(verifyOtpSchema), controller.verifyOtp);

export default router;
