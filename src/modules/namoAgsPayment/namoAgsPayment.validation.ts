import { z } from "zod";
import { AGS_PAYMENT_MODES } from "../../models/namoAgsPayment.model";

const optionalDate = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.coerce.date().optional()
);

const baseBody = z.object({
  agsDelegateId: z.string().trim().min(1, "agsDelegateId is required"),
  paymentFor: z.string().trim().max(160).optional(),
  seminarDay: z.string().trim().max(60).optional(),
  aadharOrPanNo: z
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().max(20))
    .optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paymentMode: z.enum(AGS_PAYMENT_MODES),
  bankName: z.string().trim().max(160).optional(),
  chequeNo: z.string().trim().max(60).optional(),
  dateOfIssue: optionalDate,
  branch: z.string().trim().max(160).optional(),
  paytmNo: z.string().trim().max(30).optional(),
  upiId: z.string().trim().max(80).optional(),
  transactionId: z.string().trim().max(80).optional(),
  bankReferenceNo: z.string().trim().max(80).optional(),
  orderNo: z.string().trim().max(80).optional(),
});

export const createAgsPaymentSchema = z.object({ body: baseBody });

// agsDelegateId, and every legacy money-detail field that identifies WHAT was paid, is immutable
// once recorded — the only thing an edit can legitimately do is correct a typo in the reference
// fields or amount before it's reconciled; changing which delegate a payment belongs to should be
// a cancel-and-recreate, same reasoning as AccessGrant's immutable fields.
export const updateAgsPaymentSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: baseBody.omit({ agsDelegateId: true }).partial(),
});

export const listAgsPaymentsSchema = z.object({
  query: z.object({
    agsDelegateId: z.string().trim().optional(),
    status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  }),
});
