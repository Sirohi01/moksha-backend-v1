import mongoose, { Types } from "mongoose";
import { Case, ICase } from "../../models/case.model";
import { CaseTimeline } from "../../models/caseTimeline.model";
import { CaseDocument } from "../../models/caseDocument.model";
import { CaseExpense, ICaseExpense } from "../../models/caseExpense.model";
import { ExpenseCategory } from "../../models/expenseCategory.model";
import { AssistanceRequest } from "../../models/assistanceRequest.model";
import { Volunteer } from "../../models/volunteer.model";
import { VolunteerAssignment } from "../../models/volunteerAssignment.model";
import { User } from "../../models/user.model";
import { ApiError } from "../../utils/ApiError";
import { generateCaseId } from "../../lib/counter.service";
import { writeAuditLog } from "../../lib/audit.service";
import { uploadBuffer } from "../../lib/cloudinary";
import { maybeDecrypt } from "../../lib/crypto";
import { notify } from "../../lib/notify.service";
import { CASE_STATUS_LABELS } from "../../utils/statusLabels";
import { compactFilter } from "../../utils/compactFilter";
import { toPaise, toRupees } from "../../utils/money";
import { PaginationParams, buildMeta } from "../../utils/pagination";
import {
  CASE_STATUS_TRANSITIONS,
  CaseStatus,
  CasePriority,
  VerificationStatus,
  DocumentType,
  PaymentMode,
  ExpenseStatus,
  AssignmentRole,
  ACTIVE_ASSIGNMENT_STATUSES,
  MAX_ACTIVE_CASES_PER_VOLUNTEER,
  SLA_NEW_CASE_RESPONSE_HOURS,
  SLA_CRITICAL_CASE_OPEN_HOURS,
  SLA_EXECUTION_STALL_HOURS,
} from "../../utils/constants";

/** PRD §7.1 / §11.4 — the family submitted an AssistanceRequest; a Case Manager reviews it and
 * opens the operational Case that actually gets worked. One request converts to at most one case
 * (enforced by the `requestId: unique` index on Case, belt-and-braces alongside the status check
 * below). Wrapped in a transaction: the request's SUBMITTED→CONVERTED flip and the Case creation
 * must not be allowed to happen independently. */
export async function convertRequestToCase(
  requestId: string,
  userId: string,
  priority: CasePriority = "NORMAL"
): Promise<ICase> {
  const session = await mongoose.startSession();
  let kase: ICase | undefined;
  try {
    await session.withTransaction(async () => {
      const request = await AssistanceRequest.findById(requestId).session(session);
      if (!request) throw ApiError.notFound("Request not found");
      if (request.status !== "SUBMITTED") {
        throw ApiError.conflict("Only a submitted request can be converted into a case");
      }

      // Sequence generation deliberately sits outside the transaction: a case ID can afford to
      // have gaps if the transaction later aborts, but it must never be reused, and the atomic
      // $inc in getNextSequence already guarantees that on its own.
      const caseId = await generateCaseId();
      const created = await Case.create(
        [{ caseId, requestId: request._id, priority, city: request.location.city }],
        { session }
      );
      kase = created[0];

      request.status = "CONVERTED";
      await request.save({ session });

      await CaseTimeline.create(
        [{ caseId: kase._id, event: "case.created", toStatus: "NEW", byUserId: userId, visibility: "FAMILY" }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  await writeAuditLog({
    userId,
    action: "case.created",
    entityType: "Case",
    entityId: kase!._id.toString(),
    after: { caseId: kase!.caseId, requestId },
  });

  return kase!;
}

/** PRD §8.3 — the only place a case's `status` field is ever written. Enforces
 * CASE_STATUS_TRANSITIONS and, for the CLOSED transition specifically, BR-03 (a case cannot close
 * without at least one proof document and with no expense still awaiting approval). Every
 * transition writes a FAMILY-visible timeline entry — the family watching their own case should
 * see every status change, even ones like REJECTED/CANCELLED. */
export async function transitionCaseStatus(
  caseId: string,
  toStatus: CaseStatus,
  userId: string,
  note?: string
): Promise<ICase> {
  const session = await mongoose.startSession();
  let kase: ICase | undefined;
  try {
    await session.withTransaction(async () => {
      const doc = await Case.findById(caseId).session(session);
      if (!doc) throw ApiError.notFound("Case not found");

      const legalNext = CASE_STATUS_TRANSITIONS[doc.status];
      if (!legalNext.includes(toStatus)) {
        throw ApiError.conflict(`A case in ${doc.status} cannot move to ${toStatus}`);
      }

      if (toStatus === "CLOSED") {
        const hasProof = await CaseDocument.exists({ caseId: doc._id, isProof: true }).session(session);
        if (!hasProof) {
          throw ApiError.conflict("A case cannot be closed without at least one proof document (BR-03)");
        }
        const pendingExpense = await CaseExpense.exists({ caseId: doc._id, status: "SUBMITTED" }).session(
          session
        );
        if (pendingExpense) {
          throw ApiError.conflict("All expenses must be approved or rejected before closing a case (BR-03)");
        }
      }

      const fromStatus = doc.status;
      doc.status = toStatus;
      if (toStatus === "CREMATION_COMPLETED") doc.completedAt = new Date();
      if (toStatus === "CLOSED") doc.closedAt = new Date();
      await doc.save({ session });

      await CaseTimeline.create(
        [
          {
            caseId: doc._id,
            event: "case.status_changed",
            fromStatus,
            toStatus,
            note,
            byUserId: userId,
            visibility: "FAMILY",
          },
        ],
        { session }
      );

      kase = doc;
    });
  } finally {
    await session.endSession();
  }

  await writeAuditLog({
    userId,
    action: "case.status_changed",
    entityType: "Case",
    entityId: caseId,
    after: { status: toStatus },
  });

  // Best-effort — a notification failing must never undo (or even slow down) a status change
  // that has already committed. Only fires when the family gave an email at intake.
  const request = await AssistanceRequest.findById(kase!.requestId);
  if (request?.requester.email) {
    await notify(
      "family.case_status_update",
      { email: request.requester.email },
      { requesterName: request.requester.name, caseId: kase!.caseId, statusLabel: CASE_STATUS_LABELS[toStatus] }
    );
  }

  return kase!;
}

/** PRD BR — cancellation is transitionCaseStatus's CANCELLED path, but always with a captured
 * reason (Case.cancellation), unlike a generic transition's optional freeform note. Kept as its
 * own entry point rather than overloading the generic transition endpoint with a
 * reason-required-only-for-this-one-value rule. */
export async function cancelCase(caseId: string, userId: string, reason: string): Promise<ICase> {
  const kase = await transitionCaseStatus(caseId, "CANCELLED", userId, reason);
  kase.cancellation = { reason, byUserId: new Types.ObjectId(userId), at: new Date() };
  await kase.save();
  return kase;
}

interface VerifyCaseInput {
  outcome: VerificationStatus;
  method: "CALL" | "FIELD_VISIT" | "DOCUMENT" | "VERBAL_PENDING_DOCS";
  note: string;
}

/** PRD FR-CASE-02 — records the verification decision (kept as an INTERNAL-only timeline entry;
 * the note may reference sensitive judgement calls the family shouldn't see) then drives the
 * matching status transition through the single transitionCaseStatus() gate above. */
export async function verifyCase(caseId: string, userId: string, input: VerifyCaseInput): Promise<ICase> {
  const kase = await Case.findById(caseId);
  if (!kase) throw ApiError.notFound("Case not found");
  if (kase.status !== "UNDER_VERIFICATION") {
    throw ApiError.conflict("A case can only be verified while it is under verification");
  }

  kase.verification = {
    outcome: input.outcome,
    method: input.method,
    note: input.note,
    byUserId: new Types.ObjectId(userId),
    at: new Date(),
  };
  await kase.save();

  await CaseTimeline.create({
    caseId: kase._id,
    event: "case.verified",
    note: input.note,
    byUserId: userId,
    visibility: "INTERNAL",
  });

  const toStatus: CaseStatus = input.outcome === "VERIFIED" ? "APPROVED" : "REJECTED";
  return transitionCaseStatus(caseId, toStatus, userId, `Verification outcome: ${input.outcome}`);
}

export async function assignCaseManager(caseId: string, caseManagerId: string, userId: string): Promise<ICase> {
  const kase = await Case.findByIdAndUpdate(caseId, { caseManagerId }, { new: true });
  if (!kase) throw ApiError.notFound("Case not found");

  await CaseTimeline.create({
    caseId: kase._id,
    event: "case.manager_assigned",
    byUserId: userId,
    visibility: "INTERNAL",
  });
  await writeAuditLog({
    userId,
    action: "case.manager_assigned",
    entityType: "Case",
    entityId: kase._id.toString(),
    after: { caseManagerId },
  });

  return kase;
}

interface AssignVolunteerInput {
  volunteerId: string;
  role: AssignmentRole;
  note?: string;
}

/** PRD FR-CASE-05 — assigns a volunteer to a case. Deliberately does NOT itself transition the
 * case status to VOLUNTEER_ASSIGNED: an admin may want to line up a volunteer before formally
 * committing the case forward, and a case can carry more than one active assignment (e.g. a
 * PRIMARY volunteer plus a DRIVER), so "assignment exists" and "status changed" are kept as two
 * separate, explicit actions rather than one implying the other.
 *
 * Two BRs enforced here, inside a transaction so a race between two concurrent assignment
 * requests can't both pass the same check before either writes:
 *   - a case can have at most one active PRIMARY volunteer at a time
 *   - a volunteer can carry at most MAX_ACTIVE_CASES_PER_VOLUNTEER active assignments at once
 */
export async function assignVolunteer(caseId: string, input: AssignVolunteerInput, userId: string) {
  const session = await mongoose.startSession();
  let assignment: InstanceType<typeof VolunteerAssignment> | undefined;
  let kase: ICase | undefined;
  try {
    await session.withTransaction(async () => {
      kase = (await Case.findById(caseId).session(session)) ?? undefined;
      if (!kase) throw ApiError.notFound("Case not found");

      const volunteer = await Volunteer.findById(input.volunteerId).session(session);
      if (!volunteer) throw ApiError.notFound("Volunteer not found");
      if (volunteer.status !== "ACTIVE") throw ApiError.conflict("This volunteer is not active");

      if (input.role === "PRIMARY") {
        const existingPrimary = await VolunteerAssignment.findOne({
          caseId: kase._id,
          role: "PRIMARY",
          status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
        }).session(session);
        if (existingPrimary) {
          throw ApiError.conflict("This case already has an active PRIMARY volunteer assigned");
        }
      }

      const activeCaseCount = await VolunteerAssignment.countDocuments({
        volunteerId: volunteer._id,
        status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
      }).session(session);
      if (activeCaseCount >= MAX_ACTIVE_CASES_PER_VOLUNTEER) {
        throw ApiError.conflict(
          `This volunteer already has ${MAX_ACTIVE_CASES_PER_VOLUNTEER} active case assignments — reassign or complete one first`
        );
      }

      const created = await VolunteerAssignment.create(
        [{ caseId: kase._id, volunteerId: volunteer._id, role: input.role, note: input.note, assignedBy: userId }],
        { session }
      );
      assignment = created[0];

      await CaseTimeline.create(
        [{ caseId: kase._id, event: "volunteer.assigned", note: input.note, byUserId: userId, visibility: "FAMILY" }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  await writeAuditLog({
    userId,
    action: "volunteer.assigned",
    entityType: "Case",
    entityId: kase!._id.toString(),
    after: { volunteerId: input.volunteerId, role: input.role },
  });

  const assignedVolunteer = await Volunteer.findById(input.volunteerId);
  const volunteerUser = assignedVolunteer ? await User.findById(assignedVolunteer.userId).select("name email") : null;
  if (volunteerUser?.email) {
    await notify(
      "volunteer.assigned",
      { userId: volunteerUser._id.toString(), email: volunteerUser.email },
      { name: volunteerUser.name, caseId: kase!.caseId, role: input.role, city: kase!.city }
    );
  }

  return assignment!;
}

/** PRD BR — the reassignment primitive: withdrawing an assignment (volunteer became unavailable,
 * was double-booked, etc.) frees both the case's PRIMARY slot and the volunteer's active-caseload
 * slot (WITHDRAWN isn't in ACTIVE_ASSIGNMENT_STATUSES), so a fresh assignVolunteer call can
 * immediately follow. Deliberately two calls rather than one atomic "reassign" endpoint — withdraw
 * and (re)assign are each independently useful and already fully implemented on their own. */
export async function withdrawVolunteerAssignment(
  caseId: string,
  assignmentId: string,
  userId: string,
  reason?: string
) {
  const assignment = await VolunteerAssignment.findOne({ _id: assignmentId, caseId });
  if (!assignment) throw ApiError.notFound("Assignment not found");
  if (!ACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status)) {
    throw ApiError.conflict("Only an active assignment can be withdrawn");
  }

  assignment.status = "WITHDRAWN";
  assignment.respondedAt = new Date();
  await assignment.save();

  await CaseTimeline.create({
    caseId,
    event: "volunteer.withdrawn",
    note: reason,
    byUserId: userId,
    visibility: "INTERNAL",
  });
  await writeAuditLog({
    userId,
    action: "volunteer.withdrawn",
    entityType: "Case",
    entityId: caseId,
    after: { assignmentId, reason },
  });

  const withdrawnVolunteer = await Volunteer.findById(assignment.volunteerId);
  const withdrawnUser = withdrawnVolunteer ? await User.findById(withdrawnVolunteer.userId).select("name email") : null;
  if (withdrawnUser?.email) {
    const kase = await Case.findById(caseId).select("caseId");
    await notify(
      "volunteer.withdrawn",
      { userId: withdrawnUser._id.toString(), email: withdrawnUser.email },
      { name: withdrawnUser.name, caseId: kase?.caseId ?? caseId, reason: reason ?? "Not specified" }
    );
  }

  return assignment;
}

export async function addCaseDocument(
  caseId: string,
  file: Express.Multer.File,
  docType: DocumentType,
  isProof: boolean,
  userId: string
) {
  const kase = await Case.findById(caseId);
  if (!kase) throw ApiError.notFound("Case not found");

  const { url, publicId } = await uploadBuffer(file.buffer, `moksha-sewa/cases/${kase.caseId}`);

  const document = await CaseDocument.create({
    caseId: kase._id,
    docType,
    url,
    cloudinaryPublicId: publicId,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    isProof,
    uploadedBy: userId,
  });

  kase.documentCount += 1;
  await kase.save();

  await CaseTimeline.create({
    caseId: kase._id,
    event: "document.uploaded",
    note: docType,
    byUserId: userId,
    visibility: "INTERNAL",
  });

  return document;
}

interface AddExpenseInput {
  categoryId: string;
  amount: number;
  expenseDate: Date;
  paymentMode: PaymentMode;
  payeeName?: string;
  referenceNo?: string;
}

/** Expenses are stored in integer paise (PRD §11.1); this is the one place that converts back to
 * rupees before an expense ever reaches an API response. */
function withExpenseInRupees(expense: ICaseExpense) {
  return { ...expense.toObject(), amount: toRupees(expense.amount) };
}

export async function addCaseExpense(caseId: string, input: AddExpenseInput, userId: string) {
  const kase = await Case.findById(caseId);
  if (!kase) throw ApiError.notFound("Case not found");

  const category = await ExpenseCategory.findById(input.categoryId);
  if (!category || !category.isActive) {
    throw ApiError.badRequest("Select a valid, active expense category");
  }

  const expense = await CaseExpense.create({
    caseId: kase._id,
    categoryId: category._id,
    category: category.name,
    amount: toPaise(input.amount),
    expenseDate: input.expenseDate,
    paymentMode: input.paymentMode,
    payeeName: input.payeeName,
    referenceNo: input.referenceNo,
    submittedBy: userId,
  });

  await CaseTimeline.create({
    caseId: kase._id,
    event: "expense.submitted",
    note: `${category.name}: Rs ${input.amount}`,
    byUserId: userId,
    visibility: "INTERNAL",
  });

  return withExpenseInRupees(expense);
}

/** PRD's expense approval workflow requires the approver to be someone other than the submitter —
 * enforced here at the service layer, not left as a UI-only convention. */
export async function decideCaseExpense(
  expenseId: string,
  decision: Extract<ExpenseStatus, "APPROVED" | "REJECTED">,
  userId: string,
  remark?: string
) {
  const expense = await CaseExpense.findById(expenseId);
  if (!expense) throw ApiError.notFound("Expense not found");
  if (expense.status !== "SUBMITTED") {
    throw ApiError.conflict("Only a submitted expense can be approved or rejected");
  }
  if (expense.submittedBy.toString() === userId) {
    throw ApiError.forbidden("The person who submitted an expense cannot also approve it");
  }

  expense.status = decision;
  expense.approvedBy = new Types.ObjectId(userId);
  expense.approvalRemark = remark;
  expense.approvedAt = new Date();
  await expense.save();

  if (decision === "APPROVED") {
    await Case.findByIdAndUpdate(expense.caseId, { $inc: { totalExpense: expense.amount } });
  }

  await writeAuditLog({
    userId,
    action: `expense.${decision.toLowerCase()}`,
    entityType: "CaseExpense",
    entityId: expense._id.toString(),
  });

  const submitter = await User.findById(expense.submittedBy).select("name email");
  if (submitter?.email) {
    await notify(
      "expense.decided",
      { userId: submitter._id.toString(), email: submitter.email },
      {
        name: submitter.name,
        category: expense.category,
        amount: toRupees(expense.amount).toLocaleString("en-IN"),
        decision: decision === "APPROVED" ? "approved" : "rejected",
        remark: remark ?? "",
      }
    );
  }

  return withExpenseInRupees(expense);
}

/** Attaches the decrypted (admin-gated) requester/deceased info from the linked AssistanceRequest
 * — the admin case detail view needs it, but it must never be a raw, ungated field copy. */
async function withRequestInfo(kase: ICase) {
  const request = await AssistanceRequest.findById(kase.requestId);
  const obj = { ...kase.toObject(), totalExpense: toRupees(kase.totalExpense) };
  if (!request) return { ...obj, request: null };

  const requestObj = request.toObject();
  if (requestObj.requester.email) requestObj.requester.email = maybeDecrypt(requestObj.requester.email);
  requestObj.deceased.name = maybeDecrypt(requestObj.deceased.name);
  requestObj.location.address = maybeDecrypt(requestObj.location.address);

  return { ...obj, request: requestObj };
}

export async function listCasesForAdmin(
  filter: { status?: CaseStatus; city?: string; priority?: CasePriority },
  pagination?: PaginationParams
) {
  const mongoFilter = compactFilter(filter);
  const query = Case.find(mongoFilter).sort({ priority: -1, createdAt: 1 });
  if (pagination?.requested) query.skip(pagination.skip).limit(pagination.limit);

  const [docs, total] = await Promise.all([
    query,
    pagination?.requested ? Case.countDocuments(mongoFilter) : Promise.resolve(undefined),
  ]);
  const cases = await Promise.all(docs.map(withRequestInfo));
  const meta = pagination?.requested ? buildMeta(pagination.page, pagination.limit, total!) : undefined;
  return { cases, meta };
}

export async function getCaseForAdmin(caseId: string) {
  const kase = await Case.findById(caseId);
  if (!kase) throw ApiError.notFound("Case not found");

  const [caseWithRequest, timeline, documents, expenses, assignments] = await Promise.all([
    withRequestInfo(kase),
    CaseTimeline.find({ caseId: kase._id }).sort({ at: 1 }),
    CaseDocument.find({ caseId: kase._id }).sort({ createdAt: -1 }),
    CaseExpense.find({ caseId: kase._id }).sort({ createdAt: -1 }),
    VolunteerAssignment.find({ caseId: kase._id }).sort({ createdAt: -1 }),
  ]);

  const volunteers = await Volunteer.find({ _id: { $in: assignments.map((a) => a.volunteerId) } });
  const users = await User.find({ _id: { $in: volunteers.map((v) => v.userId) } }).select("name phone");
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const volunteerById = new Map(volunteers.map((v) => [v._id.toString(), v]));

  const enrichedAssignments = assignments.map((a) => {
    const volunteer = volunteerById.get(a.volunteerId.toString());
    const user = volunteer ? userById.get(volunteer.userId.toString()) : undefined;
    return { ...a.toObject(), volunteerName: user?.name, volunteerPhone: user?.phone };
  });

  return {
    ...caseWithRequest,
    timeline,
    documents,
    expenses: expenses.map(withExpenseInRupees),
    assignments: enrichedAssignments,
  };
}

/**
 * PRD FR-REQ-05 — public tracking, no login. Looks up by Case ID + the requester's phone (the
 * one lookup key that's never encrypted). On any mismatch — unknown caseId OR wrong phone — this
 * throws the exact same "not found" error, so a wrong-phone guess can't be used to confirm that a
 * given Case ID exists (a real data-leakage vector for a public, unauthenticated endpoint).
 * Returns only FAMILY-visible fields: no caseManagerId, verification notes, totalExpense, or
 * internal timeline entries ever reach this response.
 */
export async function trackCase(caseId: string, phone: string) {
  const notFound = () => ApiError.notFound("We couldn't find a case with that ID and phone number");

  const kase = await Case.findOne({ caseId });
  if (!kase) throw notFound();

  const request = await AssistanceRequest.findById(kase.requestId);
  if (!request || request.requester.phone !== phone) throw notFound();

  const timeline = await CaseTimeline.find({ caseId: kase._id, visibility: "FAMILY" }).sort({ at: 1 });

  return {
    caseId: kase.caseId,
    status: kase.status,
    scheduledAt: kase.scheduledAt,
    completedAt: kase.completedAt,
    closedAt: kase.closedAt,
    createdAt: kase.createdAt,
    timeline: timeline.map((t) => ({ event: t.event, toStatus: t.toStatus, note: t.note, at: t.at })),
  };
}

const OPEN_CASE_STATUSES: CaseStatus[] = ["NEW", "UNDER_VERIFICATION", "APPROVED", "VOLUNTEER_ASSIGNED", "TRANSPORT_ARRANGED", "CREMATION_IN_PROGRESS", "CREMATION_COMPLETED", "DOCS_UPLOADED"];

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/**
 * PRD BR — an on-demand breach sweep (no cron infra yet — see Phase E1's notification queue for
 * where scheduled jobs eventually land; this is deliberately a query an admin can call/refresh
 * rather than a background job that would need that same infra). Three independent SLA checks;
 * a case can appear once per rule it's currently breaching.
 */
export async function listSlaBreaches() {
  const [staleNew, staleCritical, stalledExecution] = await Promise.all([
    Case.find({ status: "NEW", createdAt: { $lt: hoursAgo(SLA_NEW_CASE_RESPONSE_HOURS) } }),
    Case.find({
      priority: "CRITICAL",
      status: { $in: OPEN_CASE_STATUSES },
      createdAt: { $lt: hoursAgo(SLA_CRITICAL_CASE_OPEN_HOURS) },
    }),
    Case.find({
      status: { $in: ["TRANSPORT_ARRANGED", "CREMATION_IN_PROGRESS"] },
      updatedAt: { $lt: hoursAgo(SLA_EXECUTION_STALL_HOURS) },
    }),
  ]);

  const toBreachRow = (kase: ICase, reason: string, hours: number) => ({
    _id: kase._id,
    caseId: kase.caseId,
    status: kase.status,
    priority: kase.priority,
    city: kase.city,
    createdAt: kase.createdAt,
    breachReason: reason,
    thresholdHours: hours,
  });

  return [
    ...staleNew.map((k) => toBreachRow(k, "No response within SLA of case creation", SLA_NEW_CASE_RESPONSE_HOURS)),
    ...staleCritical.map((k) => toBreachRow(k, "Critical-priority case open past SLA", SLA_CRITICAL_CASE_OPEN_HOURS)),
    ...stalledExecution.map((k) => toBreachRow(k, "No progress since last status change", SLA_EXECUTION_STALL_HOURS)),
  ];
}

/**
 * Printable one-page case summary — same "browser Print to PDF" pattern as
 * donation.service.ts's renderReceiptHtml, for the same reason (no PDF-generation dependency for
 * what's fundamentally a static document a Case Manager hands off or files).
 */
export async function renderCaseSummaryHtml(caseId: string): Promise<string> {
  const detail = await getCaseForAdmin(caseId);
  const req = detail.request;

  const rows = (pairs: [string, string | number | undefined][]) =>
    pairs
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([label, v]) => `<div class="row"><span class="label">${label}</span><span class="value">${v}</span></div>`)
      .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Case Summary ${detail.caseId}</title>
<style>
  body { font-family: Georgia, serif; color: #2C1810; max-width: 720px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 20px; border-bottom: 2px solid #8B6A3E; padding-bottom: 12px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #8B6A3E; margin-top: 24px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
  .label { color: #7A685B; }
  .value { font-weight: 600; text-align: right; }
</style>
</head>
<body>
  <h1>Case Summary — ${detail.caseId}</h1>

  <h2>Case</h2>
  ${rows([
    ["Status", detail.status],
    ["Priority", detail.priority],
    ["City", detail.city],
    ["Total Expense", `Rs ${detail.totalExpense.toLocaleString("en-IN")}`],
    ["Created", new Date(detail.createdAt).toLocaleDateString("en-IN")],
    ["Closed", detail.closedAt ? new Date(detail.closedAt).toLocaleDateString("en-IN") : undefined],
  ])}

  <h2>Requester</h2>
  ${rows([
    ["Name", req?.requester?.name],
    ["Phone", req?.requester?.phone],
    ["Relation", req?.requester?.relation],
  ])}

  <h2>Deceased</h2>
  ${rows([
    ["Name", req?.deceased?.name],
    ["Age", req?.deceased?.age],
  ])}

  <h2>Location</h2>
  ${rows([
    ["Address", req?.location?.address],
    ["City", req?.location?.city],
    ["Pincode", req?.location?.pincode],
  ])}

  <h2>Volunteers</h2>
  ${
    detail.assignments.length
      ? detail.assignments
          .map((a: any) => `<div class="row"><span class="label">${a.role}</span><span class="value">${a.volunteerName ?? "—"} (${a.status})</span></div>`)
          .join("")
      : `<p style="font-size:13px;color:#7A685B;">No volunteers assigned.</p>`
  }
</body>
</html>`;
}
