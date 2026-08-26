import crypto from "crypto";
import { Types } from "mongoose";
import { generateArogyaDelegateCode } from "../../lib/counter.service";
import { sendArogyaAdminLeadEmail, sendArogyaGroupThankYouEmail, sendArogyaThankYouEmail } from "../../lib/arogyaNotify.service";
import { maybeDecrypt } from "../../lib/crypto";
import { writeAuditLog } from "../../lib/audit.service";
import { ArogyaDelegateRegistration, IArogyaDelegateRegistration } from "../../models/arogyaDelegateRegistration.model";
import { ArogyaPass } from "../../models/arogyaPass.model";
import { ArogyaPaymentMode, IArogyaPayment } from "../../models/arogyaPayment.model";
import { ApiError } from "../../utils/ApiError";
import * as otpService from "./arogyaRegistrationOtp.service";
import * as couponService from "../arogyaCoupon/arogyaCoupon.service";
import { createOfflinePayment, getPaidUnlinkedPayment } from "./arogyaPayment.service";

function serialize(entry: IArogyaDelegateRegistration) {
  const value = entry.toObject() as Record<string, unknown>;
  for (const field of ["email", "mobile", "whatsappNumber", "documentUrl"]) {
    if (typeof value[field] === "string") value[field] = maybeDecrypt(value[field] as string);
  }
  delete value.emailHash;
  delete value.mobileHash;
  return value;
}

export async function listAdmin(organisationId: string, filter: { registrationType?: string; search?: string }) {
  const query: Record<string, unknown> = { organisationId };
  if (filter.registrationType) query.registrationType = filter.registrationType;
  if (filter.search) {
    const re = new RegExp(filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ fullName: re }, { delegateCode: re }, { organization: re }];
  }
  const entries = await ArogyaDelegateRegistration.find(query).sort({ createdAt: -1 });
  return entries.map(serialize);
}

export async function getAdmin(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Registration not found");
  const entry = await ArogyaDelegateRegistration.findOne({ _id: id, organisationId });
  if (!entry) throw ApiError.notFound("Registration not found");
  return serialize(entry);
}

interface DelegateFormFields {
  title?: string; fullName: string; email: string; mobile: string; whatsappNumber?: string;
  designation?: string; organization?: string; country?: string; state?: string; city?: string;
  industryType?: string; areasOfInterest?: string; source?: string;
  isSpeaker?: boolean; dietary?: string; assistance?: string; documentUrl?: string;
}

export async function initiate(organisationId: string, channel: "email" | "whatsapp", destination: string, fullName: string) {
  await otpService.sendOtp(organisationId, channel, destination, fullName);
}

export async function verifyOtpStep(organisationId: string, channel: "email" | "whatsapp", destination: string, otp: string) {
  await otpService.verifyOtp(organisationId, channel, destination, otp);
}

/** "Online (Razorpay)" for a real gateway payment; the human-readable offline mode otherwise —
 * shown in both the delegate's own confirmation email and the admin lead-notification email. */
function paymentModeLabel(payment: IArogyaPayment): string {
  if (payment.gateway === "RAZORPAY") return "Online (Razorpay)";
  const labels: Record<string, string> = { CASH: "Cash", CHEQUE: "Cheque", PAYTM: "Paytm", NEFT_RTGS: "NEFT/RTGS", OTHER: "Other" };
  return labels[payment.paymentMode ?? "OTHER"] ?? "Offline";
}

/** Shared by the public OTP-verified flow and the admin offline-recording flow — the only
 * difference between them is what proves the registration is legitimate (a verified OTP vs. an
 * authenticated admin recording cash-in-hand), never how the registration/payment link is formed. */
async function buildSingleRegistration(organisationId: string, payment: IArogyaPayment, form: DelegateFormFields) {
  const pass = await ArogyaPass.findById(payment.passId);
  if (!pass) throw ApiError.internal("Linked pass no longer exists");

  const delegateCode = await generateArogyaDelegateCode();
  const registration = await ArogyaDelegateRegistration.create({
    organisationId,
    delegateCode,
    isGroupPrimary: true,
    ...form,
    registrationType: "single",
    passId: payment.passId,
    passName: pass.name,
    amountPaise: payment.amountPaise,
    selectedDays: payment.selectedDays,
    couponId: payment.couponId,
    couponCode: payment.couponCode,
    paymentId: payment._id,
  });

  payment.delegateRegistrationId = registration._id;
  await payment.save();
  if (payment.couponId) await couponService.markCouponUsed(payment.couponId.toString(), form.email);

  const paymentMode = paymentModeLabel(payment);
  const amountRupees = payment.amountPaise / 100;
  // Confirmation-email failure must never undo an already-successful, already-paid registration.
  await sendArogyaThankYouEmail({
    delegateId: delegateCode, fullName: form.fullName, email: form.email, mobile: form.mobile,
    designation: form.designation, organization: form.organization, passName: pass.name,
    amountRupees, selectedDays: payment.selectedDays, paymentMode,
  }).catch(() => {});
  await sendArogyaAdminLeadEmail({
    delegateId: delegateCode, fullName: form.fullName, email: form.email, mobile: form.mobile,
    designation: form.designation, organization: form.organization, passName: pass.name,
    amountRupees, selectedDays: payment.selectedDays, paymentMode, isGroup: false,
  }).catch(() => {});
  return registration;
}

interface CompleteSingleInput {
  paymentRecordId: string;
  otpChannel: "email" | "whatsapp";
  otpDestination: string;
  otp: string;
  form: DelegateFormFields;
}

export async function completeSingle(organisationId: string, input: CompleteSingleInput) {
  const payment = await getPaidUnlinkedPayment(organisationId, input.paymentRecordId);
  await otpService.consumeVerifiedOtp(organisationId, input.otpChannel, input.otpDestination);
  return buildSingleRegistration(organisationId, payment, input.form);
}

async function buildGroupRegistrations(
  organisationId: string,
  payment: IArogyaPayment,
  primary: DelegateFormFields,
  members: DelegateFormFields[]
) {
  const pass = await ArogyaPass.findById(payment.passId);
  if (!pass) throw ApiError.internal("Linked pass no longer exists");

  const groupId = crypto.randomUUID();
  const registrations = [];

  const primaryCode = await generateArogyaDelegateCode();
  const primaryRegistration = await ArogyaDelegateRegistration.create({
    organisationId, delegateCode: primaryCode, groupId, isGroupPrimary: true,
    ...primary, registrationType: "group", passId: payment.passId, passName: pass.name,
    amountPaise: payment.amountPaise, selectedDays: payment.selectedDays,
    couponId: payment.couponId, couponCode: payment.couponCode, paymentId: payment._id,
  });
  registrations.push(primaryRegistration);

  for (const member of members) {
    const code = await generateArogyaDelegateCode();
    const memberRegistration = await ArogyaDelegateRegistration.create({
      organisationId, delegateCode: code, groupId, isGroupPrimary: false,
      ...member, registrationType: "group", passId: payment.passId, passName: pass.name,
      amountPaise: 0, // the group's total charge is recorded once, on the primary — members are 0 here to avoid double-counting revenue
      selectedDays: payment.selectedDays, couponId: payment.couponId, couponCode: payment.couponCode,
      paymentId: payment._id,
    });
    registrations.push(memberRegistration);
  }

  payment.delegateRegistrationId = primaryRegistration._id;
  await payment.save();
  if (payment.couponId) await couponService.markCouponUsed(payment.couponId.toString(), primary.email);

  const paymentMode = paymentModeLabel(payment);
  const amountRupees = payment.amountPaise / 100;
  const memberSummaries = members.map((m) => ({ fullName: m.fullName, email: m.email, mobile: m.mobile, designation: m.designation }));
  await sendArogyaGroupThankYouEmail({
    groupId, primaryContactName: primary.fullName, organization: primary.organization, passName: pass.name,
    amountRupees, selectedDays: payment.selectedDays, members: memberSummaries, primaryEmail: primary.email,
  }).catch(() => {});
  await sendArogyaAdminLeadEmail({
    delegateId: groupId, fullName: primary.fullName, email: primary.email, mobile: primary.mobile,
    designation: primary.designation, organization: primary.organization, passName: pass.name,
    amountRupees, selectedDays: payment.selectedDays, paymentMode, isGroup: true, members: memberSummaries,
  }).catch(() => {});
  return registrations;
}

interface CompleteGroupInput {
  paymentRecordId: string;
  otpChannel: "email" | "whatsapp";
  otpDestination: string;
  otp: string;
  primary: DelegateFormFields;
  members: DelegateFormFields[];
}

export async function completeGroup(organisationId: string, input: CompleteGroupInput) {
  const payment = await getPaidUnlinkedPayment(organisationId, input.paymentRecordId);
  await otpService.consumeVerifiedOtp(organisationId, input.otpChannel, input.otpDestination);
  return buildGroupRegistrations(organisationId, payment, input.primary, input.members);
}

interface AdminOfflineBase {
  passId: string;
  selectedDays: number[];
  couponCode?: string;
  paymentMode: ArogyaPaymentMode;
  note?: string;
}

/** Admin-recorded registrations for walk-in/cash/cheque/UPI delegates the legacy system had no
 * way to represent (it assumed every registration came through Razorpay). Pricing is still
 * computed server-side from the real pass/coupon records inside createOfflinePayment — an admin
 * can choose *how* payment was received, never invent the amount — and the payment is created
 * already PAID so it flows through the exact same registration-linking/coupon-consumption path as
 * an online payment (buildSingleRegistration/buildGroupRegistrations above), not a separate one. */
export async function adminCreateOfflineSingle(
  organisationId: string,
  actorUserId: string,
  input: AdminOfflineBase & { form: DelegateFormFields }
) {
  const payment = await createOfflinePayment(organisationId, actorUserId, {
    passId: input.passId, selectedDays: input.selectedDays, registrationType: "single", groupSize: 1,
    couponCode: input.couponCode, paymentMode: input.paymentMode, note: input.note,
  });
  const registration = await buildSingleRegistration(organisationId, payment, input.form);
  await writeAuditLog({
    userId: actorUserId, action: "arogya_delegate.offline_registration_created", entityType: "ArogyaDelegateRegistration",
    entityId: registration._id.toString(), after: { passName: registration.passName, amountPaise: payment.amountPaise, paymentMode: input.paymentMode },
  });
  return registration;
}

export async function adminCreateOfflineGroup(
  organisationId: string,
  actorUserId: string,
  input: AdminOfflineBase & { groupSize: number; primary: DelegateFormFields; members: DelegateFormFields[] }
) {
  const payment = await createOfflinePayment(organisationId, actorUserId, {
    passId: input.passId, selectedDays: input.selectedDays, registrationType: "group", groupSize: input.groupSize,
    couponCode: input.couponCode, paymentMode: input.paymentMode, note: input.note,
  });
  const registrations = await buildGroupRegistrations(organisationId, payment, input.primary, input.members);
  await writeAuditLog({
    userId: actorUserId, action: "arogya_delegate.offline_group_registration_created", entityType: "ArogyaDelegateRegistration",
    entityId: registrations[0]._id.toString(), after: { passName: registrations[0].passName, amountPaise: payment.amountPaise, paymentMode: input.paymentMode, groupSize: input.groupSize },
  });
  return registrations;
}
