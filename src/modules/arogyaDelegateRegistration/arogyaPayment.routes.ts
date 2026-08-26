import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./arogyaDelegateRegistration.controller";
import { createOrderSchema, verifyPaymentSchema } from "./arogyaDelegateRegistration.validation";

const router = Router();

router.post("/create-order", validate(createOrderSchema), controller.createOrder);
router.post("/verify", validate(verifyPaymentSchema), controller.verifyPayment);

export default router;
