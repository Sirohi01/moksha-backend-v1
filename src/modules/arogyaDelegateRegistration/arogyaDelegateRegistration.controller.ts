import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { Organisation } from "../../models/organisation.model";
import * as registrationService from "./arogyaDelegateRegistration.service";
import * as paymentService from "./arogyaPayment.service";

const ORG_CODE = "AROGYA";
async function orgId() {
  const organisation = await Organisation.findOne({ code: ORG_CODE, status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Arogya organisation is not configured");
  return organisation._id.toString();
}
const scopeId = (req: Request) => {
  if (!req.scope) throw ApiError.forbidden("Organisation scope is required");
  return req.scope.organisationId;
};
const userId = (req: Request) => {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth.userId;
};

export const listAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { registrationType, search } = req.query as { registrationType?: string; search?: string };
  sendSuccess(res, 200, "Registrations fetched", await registrationService.listAdmin(scopeId(req), { registrationType, search }));
});
export const getAdminOne = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Registration fetched", await registrationService.getAdmin(scopeId(req), req.params.id))
);
export const updateAdmin = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Registration updated", await registrationService.updateAdmin(scopeId(req), userId(req), req.params.id, req.body))
);
export const exportDelegatesCsv = asyncHandler(async (req: Request, res: Response) => {
  const csv = await registrationService.exportCsv(scopeId(req));
  res.type("text/csv").attachment(`arogya-delegates-${Date.now()}.csv`).send(csv);
});

export const initiate = asyncHandler(async (req: Request, res: Response) => {
  const { channel, email, whatsappNumber, mobile, fullName } = req.body as {
    channel: "email" | "whatsapp"; email?: string; whatsappNumber?: string; mobile?: string; fullName: string;
  };
  const destination = channel === "email" ? email! : (whatsappNumber ?? mobile)!;
  await registrationService.initiate(await orgId(), channel, destination, fullName);
  sendSuccess(res, 200, `OTP sent successfully to ${channel}.`, null);
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { channel, email, whatsappNumber, otp } = req.body as {
    channel: "email" | "whatsapp"; email?: string; whatsappNumber?: string; otp: string;
  };
  const destination = channel === "email" ? email! : whatsappNumber!;
  await registrationService.verifyOtpStep(await orgId(), channel, destination, otp);
  sendSuccess(res, 200, "OTP verified", null);
});

export const verifySingle = asyncHandler(async (req: Request, res: Response) => {
  const { paymentRecordId, otpChannel, otpDestination, otp, ...form } = req.body;
  const registration = await registrationService.completeSingle(await orgId(), {
    paymentRecordId, otpChannel, otpDestination, otp, form,
  });
  sendSuccess(res, 201, "Registration completed", registration);
});

export const verifyGroup = asyncHandler(async (req: Request, res: Response) => {
  const { paymentRecordId, otpChannel, otpDestination, otp, primary, members } = req.body;
  const registrations = await registrationService.completeGroup(await orgId(), {
    paymentRecordId, otpChannel, otpDestination, otp, primary, members,
  });
  sendSuccess(res, 201, "Group registration completed", registrations);
});

export const adminCreateOfflineSingle = asyncHandler(async (req: Request, res: Response) => {
  const { passId, selectedDays, couponCode, paymentMode, note, form } = req.body;
  const registration = await registrationService.adminCreateOfflineSingle(scopeId(req), userId(req), {
    passId, selectedDays, couponCode, paymentMode, note, form,
  });
  sendSuccess(res, 201, "Offline registration recorded", registration);
});

export const adminCreateOfflineGroup = asyncHandler(async (req: Request, res: Response) => {
  const { passId, selectedDays, couponCode, paymentMode, note, groupSize, primary, members } = req.body;
  const registrations = await registrationService.adminCreateOfflineGroup(scopeId(req), userId(req), {
    passId, selectedDays, couponCode, paymentMode, note, groupSize, primary, members,
  });
  sendSuccess(res, 201, "Offline group registration recorded", registrations);
});

export const listPaymentsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status, gateway } = req.query as { status?: string; gateway?: string };
  sendSuccess(res, 200, "Payments fetched", await paymentService.listAdmin(scopeId(req), { status, gateway }));
});
export const getPaymentAdmin = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 200, "Payment fetched", await paymentService.getAdmin(scopeId(req), req.params.id))
);

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.createOrder(await orgId(), ORG_CODE, req.body);
  sendSuccess(res, 201, "Order created", result);
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const result = await paymentService.verifyPayment(ORG_CODE, {
    orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature,
  });
  sendSuccess(res, 200, "Payment verified", result);
});
