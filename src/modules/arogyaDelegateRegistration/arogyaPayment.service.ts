import crypto from "crypto";
import { Types } from "mongoose";
import { getOrgRazorpayClient } from "../../lib/razorpay";
import { resolveRazorpayConfig } from "../../lib/integrationConfig.service";
import { ArogyaPaymentMode, ArogyaPayment } from "../../models/arogyaPayment.model";
import { ApiError } from "../../utils/ApiError";
import * as passService from "../arogyaPass/arogyaPass.service";
import * as couponService from "../arogyaCoupon/arogyaCoupon.service";

interface CreateOrderInput {
  passId: string;
  selectedDays: number[];
  registrationType: "single" | "group";
  groupSize?: number;
  couponCode?: string;
}
export async function computeAmountPaise(organisationId: string, input: CreateOrderInput) {
  const pass = await passService.getTrustedPrice(organisationId, input.passId);
  const daysMultiplier = input.selectedDays.length > 0 ? input.selectedDays.length : 1;
  const groupMultiplier = input.registrationType === "group" ? Math.max(1, input.groupSize ?? 1) : 1;
  const subtotalRupees = pass.price * daysMultiplier * groupMultiplier;

  const coupon = await couponService.applyServerSideDiscount(organisationId, input.couponCode, input.registrationType);
  const discountRupees = coupon ? Math.round((subtotalRupees * coupon.discountPercent) / 100) : 0;
  const finalRupees = Math.max(0, subtotalRupees - discountRupees);

  return { amountPaise: finalRupees * 100, passName: pass.name, coupon };
}

export async function createOrder(organisationId: string, organisationCode: string, input: CreateOrderInput) {
  if (!Types.ObjectId.isValid(input.passId)) throw ApiError.badRequest("Invalid pass selected");
  const { amountPaise, coupon } = await computeAmountPaise(organisationId, input);
  if (amountPaise <= 0) throw ApiError.badRequest("Computed amount must be greater than zero");

  const razorpay = getOrgRazorpayClient(organisationCode);
  const order = await razorpay.orders.create({ amount: amountPaise, currency: "INR", receipt: `arogya_${Date.now()}` });

  const payment = await ArogyaPayment.create({
    organisationId,
    gatewayOrderId: order.id,
    amountPaise,
    currency: "INR",
    status: "CREATED",
    passId: input.passId,
    selectedDays: input.selectedDays,
    registrationType: input.registrationType,
    groupSize: input.registrationType === "group" ? Math.max(1, input.groupSize ?? 1) : 1,
    couponId: coupon?.couponId,
    couponCode: input.couponCode,
  });

  const { keyId } = resolveRazorpayConfig(organisationCode);
  return { paymentRecordId: payment._id.toString(), orderId: order.id, amount: amountPaise, currency: "INR", razorpayKeyId: keyId };
}

interface OfflineInput extends CreateOrderInput {
  paymentMode: ArogyaPaymentMode;
  note?: string;
}
export async function createOfflinePayment(organisationId: string, recordedBy: string, input: OfflineInput) {
  if (!Types.ObjectId.isValid(input.passId)) throw ApiError.badRequest("Invalid pass selected");
  const { amountPaise, coupon } = await computeAmountPaise(organisationId, input);
  if (amountPaise <= 0) throw ApiError.badRequest("Computed amount must be greater than zero");

  return ArogyaPayment.create({
    organisationId,
    gateway: "OFFLINE",
    gatewayOrderId: `OFFLINE-${crypto.randomUUID()}`,
    amountPaise,
    currency: "INR",
    status: "PAID",
    passId: input.passId,
    selectedDays: input.selectedDays,
    registrationType: input.registrationType,
    groupSize: input.registrationType === "group" ? Math.max(1, input.groupSize ?? 1) : 1,
    couponId: coupon?.couponId,
    couponCode: input.couponCode,
    paymentMode: input.paymentMode,
    note: input.note,
    recordedBy,
  });
}

interface VerifyInput { orderId: string; paymentId: string; signature: string }
export async function verifyPayment(organisationCode: string, input: VerifyInput) {
  const payment = await ArogyaPayment.findOne({ gatewayOrderId: input.orderId });
  if (!payment) throw ApiError.notFound("Payment order not found");
  if (payment.status === "PAID") return { paymentRecordId: payment._id.toString() };

  const { keySecret } = resolveRazorpayConfig(organisationCode);
  const expected = crypto.createHmac("sha256", keySecret).update(`${input.orderId}|${input.paymentId}`).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(input.signature);
  const valid = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!valid) {
    payment.status = "FAILED";
    await payment.save();
    throw ApiError.badRequest("Payment verification failed");
  }

  payment.status = "PAID";
  payment.gatewayPaymentId = input.paymentId;
  payment.gatewaySignature = input.signature;
  await payment.save();
  return { paymentRecordId: payment._id.toString() };
}

interface AdminListFilters {
  status?: string;
  gateway?: string;
}
/** Admin "Payments / Transactions" view — the only place a CREATED-but-never-completed or FAILED
 * order is visible at all; every other screen only ever sees a payment indirectly, through the
 * delegate registration it eventually produced (and a CREATED/FAILED order never produces one). */
export async function listAdmin(organisationId: string, filter: AdminListFilters) {
  const query: Record<string, unknown> = { organisationId };
  if (filter.status) query.status = filter.status;
  if (filter.gateway) query.gateway = filter.gateway;
  return ArogyaPayment.find(query)
    .sort({ createdAt: -1 })
    .populate("passId", "name")
    .populate("delegateRegistrationId", "fullName delegateCode")
    .populate("recordedBy", "name");
}

export async function getAdmin(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Payment not found");
  const payment = await ArogyaPayment.findOne({ _id: id, organisationId })
    .populate("passId", "name")
    .populate("delegateRegistrationId", "fullName delegateCode")
    .populate("recordedBy", "name");
  if (!payment) throw ApiError.notFound("Payment not found");
  return payment;
}

export async function getPaidUnlinkedPayment(organisationId: string, paymentRecordId: string) {
  if (!Types.ObjectId.isValid(paymentRecordId)) throw ApiError.badRequest("Invalid payment reference");
  const payment = await ArogyaPayment.findOne({ _id: paymentRecordId, organisationId });
  if (!payment) throw ApiError.badRequest("Payment record not found");
  if (payment.status !== "PAID") throw ApiError.badRequest("Payment has not been completed");
  if (payment.delegateRegistrationId) throw ApiError.conflict("This payment has already been used for a registration");
  return payment;
}
