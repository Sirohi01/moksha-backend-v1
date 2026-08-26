import { Types } from "mongoose";
import { generateAgsRegistrationNo } from "../../lib/counter.service";
import { writeAuditLog } from "../../lib/audit.service";
import { decryptField } from "../../lib/crypto";
import { NamoAgsDelegate } from "../../models/namoAgsDelegate.model";
import { INamoAgsPayment, NamoAgsPayment } from "../../models/namoAgsPayment.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";

type PaymentInput = Record<string, unknown>;

function serialize(payment: INamoAgsPayment) {
  const value = payment.toObject() as Record<string, unknown>;
  delete value.aadharOrPanNo;
  return value;
}

async function assertDelegateInOrg(organisationId: string, agsDelegateId: string) {
  if (!Types.ObjectId.isValid(agsDelegateId)) throw ApiError.badRequest("agsDelegateId is invalid");
  const delegate = await NamoAgsDelegate.findOne({ _id: agsDelegateId, organisationId }).select("_id");
  if (!delegate) throw ApiError.badRequest("agsDelegateId does not match a delegate in this organisation");
}

export async function createPayment(organisationId: string, input: PaymentInput, userId: string) {
  const { agsDelegateId, ...rest } = input as { agsDelegateId: string } & PaymentInput;
  await assertDelegateInOrg(organisationId, agsDelegateId);

  const registrationNo = await generateAgsRegistrationNo();
  const payment = await NamoAgsPayment.create({
    ...rest,
    agsDelegateId,
    organisationId,
    registrationNo,
    createdBy: userId,
  });
  await writeAuditLog({
    userId,
    action: "ags_payment.created",
    entityType: "NamoAgsPayment",
    entityId: payment._id.toString(),
    after: { registrationNo, amount: payment.amount, paymentMode: payment.paymentMode },
  });
  return serialize(payment);
}

export async function listPayments(organisationId: string, filter: { agsDelegateId?: string; status?: string }) {
  const query = { organisationId, ...compactFilter(filter) };
  const payments = await NamoAgsPayment.find(query).sort({ createdAt: -1 });
  return payments.map(serialize);
}

export async function getPayment(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Payment not found");
  const payment = await NamoAgsPayment.findOne({ _id: id, organisationId }).select("+aadharOrPanNo");
  if (!payment) throw ApiError.notFound("Payment not found");
  const value = serialize(payment);
  if (payment.aadharOrPanNo) {
    const plain = decryptField(payment.aadharOrPanNo);
    value.aadharOrPanMasked = `********${plain.slice(-4)}`;
  }
  return value;
}

export async function updatePayment(organisationId: string, id: string, input: PaymentInput, userId: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Payment not found");
  const payment = await NamoAgsPayment.findOne({ _id: id, organisationId });
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status === "CANCELLED") throw ApiError.badRequest("A cancelled payment cannot be edited");

  payment.set(input);
  payment.updatedBy = userId as unknown as typeof payment.updatedBy;
  await payment.save();
  return serialize(payment);
}

/** Matches the legacy behaviour exactly: a payment is cancelled (status flag), never hard-deleted
 * — this is a financial record, and "cancel" preserves the audit trail a delete would destroy. */
export async function cancelPayment(organisationId: string, id: string, userId: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Payment not found");
  const payment = await NamoAgsPayment.findOne({ _id: id, organisationId });
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status === "CANCELLED") return serialize(payment); // idempotent

  payment.status = "CANCELLED";
  payment.updatedBy = userId as unknown as typeof payment.updatedBy;
  await payment.save();
  await writeAuditLog({
    userId,
    action: "ags_payment.cancelled",
    entityType: "NamoAgsPayment",
    entityId: payment._id.toString(),
    before: { status: "ACTIVE" },
    after: { status: "CANCELLED" },
  });
  return serialize(payment);
}
