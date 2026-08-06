import crypto from "crypto";
import { User } from "../../models/user.model";
import { Donor, IDonor } from "../../models/donor.model";
import { Donation, IDonation } from "../../models/donation.model";
import { Campaign } from "../../models/campaign.model";
import { PaymentTransaction, IPaymentTransaction } from "../../models/paymentTransaction.model";
import { RecurringDonation, IRecurringDonation } from "../../models/recurringDonation.model";
import { Receipt, IReceipt } from "../../models/receipt.model";
import { Setting } from "../../models/setting.model";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import { getRazorpayClient } from "../../lib/razorpay";
import { decryptField, maybeDecrypt } from "../../lib/crypto";
import { generateReceiptNo } from "../../lib/counter.service";
import { notify } from "../../lib/notify.service";
import { writeAuditLog } from "../../lib/audit.service";
import { compactFilter } from "../../utils/compactFilter";
import { toPaise, toRupees } from "../../utils/money";
import { PaginationParams, buildMeta } from "../../utils/pagination";
import { DonationCause, DonationFrequency, NewDonationStatus, PaymentMode, SubscriptionStatus } from "../../utils/constants";

interface DonorInput {
  name: string;
  email: string;
  phone: string;
  pan?: string;
}

/** Donations are guest-checkout — this is the one dedup point: same email always resolves to the
 * same Donor, so a returning giver's history accumulates instead of fragmenting per donation. */
async function findOrCreateDonor(input: DonorInput): Promise<IDonor> {
  const email = input.email.trim().toLowerCase();
  let donor = await Donor.findOne({ email });

  if (!donor) {
    donor = await Donor.create({ name: input.name, email, phone: input.phone, pan: input.pan?.trim().toUpperCase() });
  } else if (input.pan) {
    donor.pan = input.pan.trim().toUpperCase();
    await donor.save();
  }

  return donor;
}

/** PRD FR-DON-06 — every successful donation gets a receipt, unconditionally. 80G eligibility
 * (FR-DON-08) is only a flag on that receipt, snapshotting whether the org's exemption
 * registration was on file at issuance time — never a precondition for issuing the receipt at
 * all (that was the earlier bug: no exemptionRef silently meant no receipt for anyone). */
async function issueReceipt(donation: IDonation, donor: IDonor): Promise<IReceipt> {
  const settings = await Setting.findOne();
  const receiptNo = await generateReceiptNo();
  const panPlain = donor.pan ? decryptField(donor.pan) : undefined;

  const receipt = await Receipt.create({
    receiptNo,
    donationId: donation._id,
    donorId: donor._id,
    amount: donation.amount,
    panUsed: panPlain,
    is80GEligible: !!settings?.organisation?.exemptionRef,
  });

  donation.receiptId = receipt._id;
  await donation.save();

  return receipt;
}

interface CreateDonationInput {
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  pan?: string;
  dedication?: string;
  isAnonymous: boolean;
  cause: DonationCause;
  campaignId?: string;
  amount: number;
  frequency: DonationFrequency;
}

async function createOneTimeDonation(donor: IDonor, input: CreateDonationInput) {
  const amountPaise = toPaise(input.amount);

  const donation = await Donation.create({
    donorId: donor._id,
    campaignId: input.campaignId,
    cause: input.cause,
    type: "ONE_TIME",
    amount: amountPaise,
    isAnonymous: input.isAnonymous,
    dedication: input.dedication,
  });

  let order;
  try {
    const razorpay = getRazorpayClient();
    // Razorpay's own API is paise-native — amountPaise needs no further conversion here.
    order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `donation_${donation._id}`,
    });
  } catch {
    throw ApiError.internal("Online payments are not configured yet — please contact us to complete your donation.");
  }

  await PaymentTransaction.create({
    donationId: donation._id,
    orderId: order.id,
    amount: amountPaise,
    status: "created",
  });

  return { donation, order, subscriptionId: undefined as string | undefined };
}

/** Razorpay Plans have a fixed amount, but donors choose their own recurring amount, so a
 * dedicated Plan is created per subscription rather than reused from a shared catalog — an
 * accepted trade-off (many small plans in the Razorpay dashboard) for genuinely variable giving. */
async function createRecurringDonationFlow(donor: IDonor, input: CreateDonationInput) {
  const razorpay = getRazorpayClient();
  const amountPaise = toPaise(input.amount);

  let plan, subscription;
  try {
    // Razorpay's own API is paise-native — amountPaise needs no further conversion here.
    plan = await razorpay.plans.create({
      period: "monthly",
      interval: 1,
      item: { name: "Moksha Sewa Monthly Donation", amount: amountPaise, currency: "INR" },
    });
    subscription = await razorpay.subscriptions.create({
      plan_id: plan.id,
      customer_notify: 1,
      total_count: 120, // 10 years of monthly charges, or until the donor cancels
    });
  } catch {
    throw ApiError.internal("Recurring payments are not configured yet — please contact us to set this up.");
  }

  const recurring = await RecurringDonation.create({
    donorId: donor._id,
    campaignId: input.campaignId,
    cause: input.cause,
    amount: amountPaise,
    razorpayPlanId: plan.id,
    razorpaySubscriptionId: subscription.id,
    status: "PENDING",
  });

  const donation = await Donation.create({
    donorId: donor._id,
    campaignId: input.campaignId,
    cause: input.cause,
    type: "RECURRING",
    amount: amountPaise,
    isAnonymous: input.isAnonymous,
    dedication: input.dedication,
    recurringDonationId: recurring._id,
  });

  await PaymentTransaction.create({
    donationId: donation._id,
    subscriptionId: subscription.id,
    amount: amountPaise,
    status: "created",
  });

  return { donation, order: undefined, subscriptionId: subscription.id as string };
}

export async function createDonation(input: CreateDonationInput) {
  const donor = await findOrCreateDonor({
    name: input.donorName,
    email: input.donorEmail,
    phone: input.donorPhone,
    pan: input.pan,
  });

  const { donation, order, subscriptionId } =
    input.frequency === "monthly" ? await createRecurringDonationFlow(donor, input) : await createOneTimeDonation(donor, input);

  return { donation, order, subscriptionId };
}

interface VerifyDonationInput {
  donationId: string;
  paymentId: string;
  orderId?: string;
  subscriptionId?: string;
  signature: string;
}

/**
 * The one place a donation actually transitions to SUCCESS and its side effects fire (donor
 * total, campaign total, receipt, thank-you notification). Idempotent by design — both the
 * client's post-checkout /verify call AND the Razorpay webhook (PRD §16.1's authoritative
 * confirmation, which can arrive before, after, or instead of the client call) end up here, and
 * a donation already marked SUCCESS is a no-op rather than double-counted.
 */
async function confirmPaymentTransaction(
  transaction: IPaymentTransaction,
  donation: IDonation,
  paymentId: string,
  signature?: string
): Promise<IDonation> {
  if (donation.status === "SUCCESS") return donation;

  transaction.status = "paid";
  transaction.paymentId = paymentId;
  if (signature) transaction.signature = signature;
  await transaction.save();

  donation.status = "SUCCESS";
  await donation.save();

  const donor = await Donor.findById(donation.donorId);
  if (!donor) throw ApiError.internal("Donor record missing for a verified donation");

  donor.totalDonated += donation.amount;
  await donor.save();

  if (donation.campaignId) {
    await Campaign.findByIdAndUpdate(donation.campaignId, { $inc: { raisedAmount: donation.amount } });
  }
  if (donation.recurringDonationId) {
    await RecurringDonation.findByIdAndUpdate(donation.recurringDonationId, {
      status: "ACTIVE",
      lastChargedAt: new Date(),
    });
  }

  await issueReceipt(donation, donor);

  if (donor.email) {
    await notify(
      "donation.thankyou",
      { userId: donor._id.toString(), email: donor.email },
      { name: donor.name, amount: String(toRupees(donation.amount)) }
    );
  }

  return donation;
}

/** Mirrors confirmPaymentTransaction's idempotency for the failure path — never downgrades a
 * donation that some other event (e.g. a webhook that arrived first) already confirmed SUCCESS. */
async function markPaymentTransactionFailed(
  transaction: IPaymentTransaction,
  donation: IDonation
): Promise<void> {
  if (donation.status === "SUCCESS") return;
  transaction.status = "failed";
  await transaction.save();
  donation.status = "FAILED";
  await donation.save();
}

export async function verifyDonation(input: VerifyDonationInput) {
  if (!env.RAZORPAY_KEY_SECRET) throw ApiError.internal("Razorpay is not configured");

  const donation = await Donation.findById(input.donationId);
  if (!donation) throw ApiError.notFound("Donation not found");

  const transaction = await PaymentTransaction.findOne({ donationId: donation._id }).sort({ createdAt: -1 });
  if (!transaction) throw ApiError.notFound("No payment transaction found for this donation");

  // Order-based (one-time) and subscription-based (recurring) checkouts sign a different string —
  // Razorpay's own documented convention, not a choice made here.
  const expectedSignature = input.orderId
    ? crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${input.orderId}|${input.paymentId}`).digest("hex")
    : crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${input.paymentId}|${input.subscriptionId}`).digest("hex");

  if (expectedSignature !== input.signature) {
    await markPaymentTransactionFailed(transaction, donation);
    throw ApiError.badRequest("Payment verification failed");
  }

  await confirmPaymentTransaction(transaction, donation, input.paymentId, input.signature);

  const donor = await Donor.findById(donation.donorId);
  if (!donor) throw ApiError.internal("Donor record missing for a verified donation");

  return serializeDonationForDonor(donation, donor);
}

/**
 * Webhook path for a one-time (order-based) payment.captured/payment.failed event — looks up the
 * PaymentTransaction this app created at checkout time by Razorpay's order_id. This is the
 * authoritative confirmation: it fires even if the donor's browser never returns from checkout to
 * call /donations/verify (closed tab, network drop, etc.).
 */
export async function confirmOneTimePaymentByOrderId(
  orderId: string,
  paymentId: string
): Promise<void> {
  const transaction = await PaymentTransaction.findOne({ orderId }).sort({ createdAt: -1 });
  if (!transaction) return; // Not one of ours (or a recurring charge's auto-generated order) — ignore.

  const donation = await Donation.findById(transaction.donationId);
  if (!donation) return;

  await confirmPaymentTransaction(transaction, donation, paymentId);
}

export async function failOneTimePaymentByOrderId(orderId: string): Promise<void> {
  const transaction = await PaymentTransaction.findOne({ orderId }).sort({ createdAt: -1 });
  if (!transaction) return;

  const donation = await Donation.findById(transaction.donationId);
  if (!donation) return;

  await markPaymentTransactionFailed(transaction, donation);
}

/**
 * Webhook path for subscription.charged — each successful recurring auto-charge is a brand new
 * gift, so it gets its own Donation + PaymentTransaction (and, per issueReceipt, its own
 * receipt), distinct from the single Donation created when the subscription was first set up.
 * Idempotent on Razorpay's payment_id, since webhook delivery is at-least-once and can repeat.
 */
export async function recordRecurringCharge(input: {
  subscriptionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
}): Promise<void> {
  const alreadyRecorded = await PaymentTransaction.findOne({ paymentId: input.razorpayPaymentId });
  if (alreadyRecorded) return;

  const recurring = await RecurringDonation.findOne({ razorpaySubscriptionId: input.subscriptionId });
  if (!recurring) return; // Subscription not created by this app — nothing to attach the charge to.

  const donor = await Donor.findById(recurring.donorId);
  if (!donor) return;

  const donation = await Donation.create({
    donorId: recurring.donorId,
    campaignId: recurring.campaignId,
    cause: recurring.cause,
    type: "RECURRING",
    amount: input.amount,
    recurringDonationId: recurring._id,
  });

  const transaction = await PaymentTransaction.create({
    donationId: donation._id,
    orderId: input.razorpayOrderId,
    subscriptionId: input.subscriptionId,
    amount: input.amount,
    status: "created",
  });

  await confirmPaymentTransaction(transaction, donation, input.razorpayPaymentId);
}

export async function updateRecurringStatusBySubscriptionId(
  subscriptionId: string,
  status: Extract<SubscriptionStatus, "CANCELLED" | "COMPLETED" | "HALTED">
): Promise<void> {
  const update: { status: typeof status; cancelledAt?: Date } = { status };
  if (status === "CANCELLED") update.cancelledAt = new Date();
  const recurring = await RecurringDonation.findOneAndUpdate(
    { razorpaySubscriptionId: subscriptionId },
    update,
    { new: true }
  );

  // HALTED is Razorpay's signal that repeated charge attempts have failed — the donor's card is
  // the likely cause, and only they can fix it, so this is the one recurring-status transition
  // worth interrupting them for.
  if (status === "HALTED" && recurring) {
    const donor = await Donor.findById(recurring.donorId);
    if (donor?.email) {
      await notify(
        "donation.recurring_payment_failed",
        { userId: donor._id.toString(), email: donor.email },
        { name: donor.name, amount: toRupees(recurring.amount).toLocaleString("en-IN") }
      );
    }
  }
}

/** RecurringDonation.amount is integer paise (PRD §11.1) — converted to rupees before an entry
 * ever reaches an API response. */
function withRecurringInRupees(recurring: IRecurringDonation) {
  return { ...recurring.toObject(), amount: toRupees(recurring.amount) };
}

async function findRecurringDonationOwnedByUser(recurringId: string, userId: string): Promise<IRecurringDonation> {
  const user = await User.findById(userId);
  if (!user?.email) throw ApiError.notFound("Recurring donation not found");

  const donor = await Donor.findOne({ email: user.email.trim().toLowerCase() });
  if (!donor) throw ApiError.notFound("Recurring donation not found");

  const recurring = await RecurringDonation.findOne({ _id: recurringId, donorId: donor._id });
  if (!recurring) throw ApiError.notFound("Recurring donation not found");
  return recurring;
}

async function findRecurringDonationForAdmin(recurringId: string): Promise<IRecurringDonation> {
  const recurring = await RecurringDonation.findById(recurringId);
  if (!recurring) throw ApiError.notFound("Recurring donation not found");
  return recurring;
}

async function pauseRecurringDonation(recurring: IRecurringDonation) {
  if (recurring.status !== "ACTIVE") {
    throw ApiError.conflict("Only an active recurring donation can be paused");
  }
  try {
    await getRazorpayClient().subscriptions.pause(recurring.razorpaySubscriptionId, { pause_at: "now" });
  } catch {
    throw ApiError.internal("Could not pause the subscription with the payment gateway");
  }
  recurring.status = "PAUSED";
  await recurring.save();
  return withRecurringInRupees(recurring);
}

async function resumeRecurringDonation(recurring: IRecurringDonation) {
  if (recurring.status !== "PAUSED") {
    throw ApiError.conflict("Only a paused recurring donation can be resumed");
  }
  try {
    await getRazorpayClient().subscriptions.resume(recurring.razorpaySubscriptionId, { resume_at: "now" });
  } catch {
    throw ApiError.internal("Could not resume the subscription with the payment gateway");
  }
  recurring.status = "ACTIVE";
  await recurring.save();
  return withRecurringInRupees(recurring);
}

async function cancelRecurringDonation(recurring: IRecurringDonation) {
  if (recurring.status === "CANCELLED" || recurring.status === "COMPLETED") {
    throw ApiError.conflict("This recurring donation is already ended");
  }
  try {
    await getRazorpayClient().subscriptions.cancel(recurring.razorpaySubscriptionId, false);
  } catch {
    throw ApiError.internal("Could not cancel the subscription with the payment gateway");
  }
  recurring.status = "CANCELLED";
  recurring.cancelledAt = new Date();
  await recurring.save();
  return withRecurringInRupees(recurring);
}

/** Self-service — same donor-email-match pattern as listMyDonations. */
export async function listMyRecurringDonations(userId: string) {
  const user = await User.findById(userId);
  if (!user?.email) return [];

  const donor = await Donor.findOne({ email: user.email.trim().toLowerCase() });
  if (!donor) return [];

  const recurring = await RecurringDonation.find({ donorId: donor._id }).sort({ createdAt: -1 });
  return recurring.map(withRecurringInRupees);
}

export async function pauseMyRecurringDonation(recurringId: string, userId: string) {
  return pauseRecurringDonation(await findRecurringDonationOwnedByUser(recurringId, userId));
}
export async function resumeMyRecurringDonation(recurringId: string, userId: string) {
  return resumeRecurringDonation(await findRecurringDonationOwnedByUser(recurringId, userId));
}
export async function cancelMyRecurringDonation(recurringId: string, userId: string) {
  return cancelRecurringDonation(await findRecurringDonationOwnedByUser(recurringId, userId));
}

export async function listRecurringDonationsForAdmin(filter: { status?: SubscriptionStatus }) {
  const recurring = await RecurringDonation.find(compactFilter(filter)).sort({ createdAt: -1 });
  return recurring.map(withRecurringInRupees);
}
export async function pauseRecurringDonationAdmin(recurringId: string) {
  return pauseRecurringDonation(await findRecurringDonationForAdmin(recurringId));
}
export async function resumeRecurringDonationAdmin(recurringId: string) {
  return resumeRecurringDonation(await findRecurringDonationForAdmin(recurringId));
}
export async function cancelRecurringDonationAdmin(recurringId: string) {
  return cancelRecurringDonation(await findRecurringDonationForAdmin(recurringId));
}

interface RecordOfflineDonationInput {
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  pan?: string;
  dedication?: string;
  cause: DonationCause;
  campaignId?: string;
  amount: number;
  paymentMode: PaymentMode;
  referenceNo?: string;
}

/** PRD FR — recording a cash/cheque/bank-transfer donation the org received outside the website.
 * Immediately SUCCESS (there's no gateway step to wait on) and eligible for a receipt like any
 * other successful donation. */
export async function recordOfflineDonation(input: RecordOfflineDonationInput, actorUserId: string) {
  const donor = await findOrCreateDonor({
    name: input.donorName,
    email: input.donorEmail,
    phone: input.donorPhone,
    pan: input.pan,
  });

  const amountPaise = toPaise(input.amount);

  const donation = await Donation.create({
    donorId: donor._id,
    campaignId: input.campaignId,
    cause: input.cause,
    type: "OFFLINE",
    amount: amountPaise,
    status: "SUCCESS",
    dedication: input.dedication,
  });

  donor.totalDonated += amountPaise;
  await donor.save();

  if (input.campaignId) {
    await Campaign.findByIdAndUpdate(input.campaignId, { $inc: { raisedAmount: amountPaise } });
  }

  await issueReceipt(donation, donor);

  await writeAuditLog({
    userId: actorUserId,
    action: "donation.recorded_offline",
    entityType: "Donation",
    entityId: donation._id.toString(),
    after: { amount: input.amount, paymentMode: input.paymentMode, referenceNo: input.referenceNo },
  });

  return withDonationInRupees(donation);
}

export async function updateDonationStatus(donationId: string, status: NewDonationStatus, actorUserId: string) {
  const donation = await Donation.findByIdAndUpdate(donationId, { status }, { new: true });
  if (!donation) throw ApiError.notFound("Donation not found");

  await writeAuditLog({
    userId: actorUserId,
    action: "donation.status_changed",
    entityType: "Donation",
    entityId: donation._id.toString(),
    after: { status },
  });

  return withDonationInRupees(donation);
}

/** Donations/donors are stored in integer paise (PRD §11.1) — these are the two places that
 * convert back to rupees before either ever reaches an API response. */
function withDonationInRupees(donation: IDonation) {
  return { ...donation.toObject(), amount: toRupees(donation.amount) };
}
function withDonorAmountsInRupees(donor: IDonor) {
  return { ...donor.toObject(), totalDonated: toRupees(donor.totalDonated) };
}

/** Attaches the admin-gated (maybeDecrypt) donor identity onto a donation for list/detail views —
 * donations no longer carry donor PII directly, so this is the join every admin view needs. */
async function withDonorInfo(donation: IDonation) {
  const donor = await Donor.findById(donation.donorId);
  const obj = withDonationInRupees(donation);
  if (!donor) return { ...obj, donor: null };

  const donorObj = withDonorAmountsInRupees(donor);
  if (donorObj.pan) donorObj.pan = maybeDecrypt(donorObj.pan);

  return { ...obj, donor: donorObj };
}

function serializeDonationForDonor(donation: IDonation, donor: IDonor) {
  const obj = withDonationInRupees(donation);
  const donorObj = withDonorAmountsInRupees(donor);
  if (donorObj.pan) donorObj.pan = decryptField(donorObj.pan);
  return { ...obj, donor: donorObj };
}

export async function listDonationsForAdmin(filter: { status?: NewDonationStatus }, pagination?: PaginationParams) {
  const mongoFilter = compactFilter(filter);
  const query = Donation.find(mongoFilter).sort({ createdAt: -1 });
  if (pagination?.requested) query.skip(pagination.skip).limit(pagination.limit);

  const [docs, total] = await Promise.all([
    query,
    pagination?.requested ? Donation.countDocuments(mongoFilter) : Promise.resolve(undefined),
  ]);
  const donations = await Promise.all(docs.map(withDonorInfo));
  const meta = pagination?.requested ? buildMeta(pagination.page, pagination.limit, total!) : undefined;
  return { donations, meta };
}

export async function getDonationSummary() {
  const [summary] = await Donation.aggregate([
    { $match: { status: "SUCCESS" } },
    { $group: { _id: null, totalRaised: { $sum: "$amount" }, totalDonations: { $sum: 1 } } },
  ]);

  return {
    totalRaised: toRupees(summary?.totalRaised ?? 0),
    totalDonations: summary?.totalDonations ?? 0,
  };
}

/** Self-service — matches the logged-in DONOR user's email against the Donor collection live,
 * rather than requiring a stored link. A donor who gave as a guest before ever creating an
 * account still sees their full history the moment they log in with the same email. */
export async function listMyDonations(userId: string) {
  const user = await User.findById(userId);
  if (!user?.email) return [];

  const donor = await Donor.findOne({ email: user.email.trim().toLowerCase() });
  if (!donor) return [];

  const donations = await Donation.find({ donorId: donor._id }).sort({ createdAt: -1 });
  return donations.map(withDonationInRupees);
}

export async function getReceiptForDonor(donationId: string, userId: string): Promise<IReceipt> {
  const user = await User.findById(userId);
  if (!user?.email) throw ApiError.notFound("Receipt not found");

  const donor = await Donor.findOne({ email: user.email.trim().toLowerCase() });
  if (!donor) throw ApiError.notFound("Receipt not found");

  const receipt = await Receipt.findOne({ donationId, donorId: donor._id });
  if (!receipt) throw ApiError.notFound("Receipt not found");
  return receipt;
}

export async function getReceiptForAdmin(receiptId: string): Promise<IReceipt> {
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) throw ApiError.notFound("Receipt not found");
  return receipt;
}

/**
 * Renders a printable 80G receipt as HTML — the browser's own "Print to PDF" covers the PDF need
 * without pulling in a PDF-generation dependency for what's fundamentally a static, one-page
 * document. If a downloadable-PDF requirement shows up later, this is the one place to swap.
 */
export async function renderReceiptHtml(receipt: IReceipt): Promise<string> {
  const [donor, settings] = await Promise.all([Donor.findById(receipt.donorId), Setting.findOne()]);
  const org = settings?.organisation;
  const panDisplay = receipt.panUsed ? decryptField(receipt.panUsed) : "—";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${receipt.receiptNo}</title>
<style>
  body { font-family: Georgia, serif; color: #2C1810; max-width: 640px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 20px; border-bottom: 2px solid #8B6A3E; padding-bottom: 12px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
  .label { color: #7A685B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .value { font-weight: 600; }
  .amount { font-size: 28px; color: #8B6A3E; margin: 20px 0; }
  .footer { margin-top: 30px; font-size: 12px; color: #7A685B; }
</style>
</head>
<body>
  <h1>${org?.legalName ?? "Moksha Sewa"} — Donation Receipt</h1>
  <div class="row"><span class="label">Receipt No.</span><span class="value">${receipt.receiptNo}</span></div>
  <div class="row"><span class="label">Date</span><span class="value">${new Date(receipt.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span></div>
  <div class="row"><span class="label">Donor Name</span><span class="value">${donor?.name ?? "—"}</span></div>
  <div class="row"><span class="label">PAN</span><span class="value">${panDisplay}</span></div>
  <div class="amount">₹${toRupees(receipt.amount).toLocaleString("en-IN")}</div>
  ${
    receipt.is80GEligible && org?.exemptionRef
      ? `<div class="row"><span class="label">80G Exemption Ref.</span><span class="value">${org.exemptionRef}</span></div>`
      : ""
  }
  ${org?.panNumber ? `<div class="row"><span class="label">Org PAN</span><span class="value">${org.panNumber}</span></div>` : ""}
  ${org?.registeredAddress ? `<div class="row"><span class="label">Registered Address</span><span class="value">${org.registeredAddress}</span></div>` : ""}
  <p class="footer">${
    receipt.is80GEligible
      ? "This receipt is eligible for tax deduction under Section 80G of the Income Tax Act, 1961. Thank you for supporting Moksha Sewa."
      : "Thank you for supporting Moksha Sewa."
  }</p>
</body>
</html>`;
}
