import { Case } from "../../models/case.model";
import { AssistanceRequest } from "../../models/assistanceRequest.model";
import { Volunteer } from "../../models/volunteer.model";
import { Donation } from "../../models/donation.model";
import { CaseExpense } from "../../models/caseExpense.model";
import { ReportSnapshot } from "../../models/reportSnapshot.model";
import { CASE_STATUSES, CaseStatus } from "../../utils/constants";
import { toRupees } from "../../utils/money";
import { dateKey } from "../../lib/reportSnapshot.service";

const OPEN_CASE_STATUSES: CaseStatus[] = CASE_STATUSES.filter(
  (s) => s !== "CLOSED" && s !== "REJECTED" && s !== "CANCELLED"
);

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** PRD §19.1 — the admin dashboard/reports overview. Every number here is a live aggregate, not
 * cached, so it's only ever as expensive as one query per domain — fine at this data volume, and
 * simpler than adding a materialized-view layer before there's evidence it's needed. */
export async function getOverview() {
  const [
    totalCases,
    openCases,
    criticalCases,
    casesByStatus,
    totalRequests,
    pendingRequests,
    totalVolunteers,
    activeVolunteers,
    donationAgg,
    donationsThisMonthAgg,
    donationsByCause,
    pendingExpenseAgg,
    approvedExpenseAgg,
  ] = await Promise.all([
    Case.countDocuments(),
    Case.countDocuments({ status: { $in: OPEN_CASE_STATUSES } }),
    Case.countDocuments({ priority: "CRITICAL", status: { $in: OPEN_CASE_STATUSES } }),
    Case.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    AssistanceRequest.countDocuments(),
    AssistanceRequest.countDocuments({ status: "SUBMITTED" }),
    Volunteer.countDocuments(),
    Volunteer.countDocuments({ status: "ACTIVE" }),
    Donation.aggregate([
      { $match: { status: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Donation.aggregate([
      { $match: { status: "SUCCESS", createdAt: { $gte: startOfMonth() } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Donation.aggregate([{ $match: { status: "SUCCESS" } }, { $group: { _id: "$cause", total: { $sum: "$amount" } } }]),
    CaseExpense.aggregate([
      { $match: { status: "SUBMITTED" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    CaseExpense.aggregate([
      { $match: { status: "APPROVED" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const status of CASE_STATUSES) statusCounts[status] = 0;
  for (const row of casesByStatus) statusCounts[row._id] = row.count;

  const causeBreakdown: Record<string, number> = {};
  for (const row of donationsByCause) causeBreakdown[row._id] = toRupees(row.total);

  return {
    cases: { total: totalCases, open: openCases, critical: criticalCases, byStatus: statusCounts },
    requests: { total: totalRequests, pending: pendingRequests },
    volunteers: { total: totalVolunteers, active: activeVolunteers },
    donations: {
      totalRaised: toRupees(donationAgg[0]?.total ?? 0),
      totalDonations: donationAgg[0]?.count ?? 0,
      thisMonthRaised: toRupees(donationsThisMonthAgg[0]?.total ?? 0),
      thisMonthDonations: donationsThisMonthAgg[0]?.count ?? 0,
      byCause: causeBreakdown,
    },
    expenses: {
      pendingAmount: toRupees(pendingExpenseAgg[0]?.total ?? 0),
      pendingCount: pendingExpenseAgg[0]?.count ?? 0,
      approvedAmount: toRupees(approvedExpenseAgg[0]?.total ?? 0),
      approvedCount: approvedExpenseAgg[0]?.count ?? 0,
    },
  };
}

function toCsvValue(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => toCsvValue(row[h])).join(","));
  return lines.join("\n");
}

/** PRD "reports.export" — a case register snapshot. Deliberately excludes anything encrypted
 * (requester/deceased PII) since this is a bulk export, and gating what leaves the system in bulk
 * matters more here than for a single-record admin view. */
export async function exportCasesCsv(): Promise<string> {
  const cases = await Case.find().sort({ createdAt: -1 });
  return toCsv(
    cases.map((c) => ({
      caseId: c.caseId,
      status: c.status,
      priority: c.priority,
      city: c.city,
      totalExpense: toRupees(c.totalExpense),
      documentCount: c.documentCount,
      createdAt: c.createdAt.toISOString(),
      closedAt: c.closedAt?.toISOString() ?? "",
    }))
  );
}

export async function exportDonationsCsv(): Promise<string> {
  const donations = await Donation.find().sort({ createdAt: -1 });
  return toCsv(
    donations.map((d) => ({
      id: d._id.toString(),
      cause: d.cause,
      type: d.type,
      amount: toRupees(d.amount),
      status: d.status,
      isAnonymous: d.isAnonymous,
      createdAt: d.createdAt.toISOString(),
    }))
  );
}

/** PRD Phase F3 — the trend line getOverview() can't answer on its own: cumulative totals as of
 * each of the last `days` calendar days, captured by reportSnapshot.service.ts's hourly sweep.
 * "YYYY-MM-DD" strings sort lexicographically the same as chronologically, so a plain $gte works. */
export async function listSnapshots(days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return ReportSnapshot.find({ date: { $gte: dateKey(cutoff) } }).sort({ date: 1 });
}

/** PRD Phase F3 — public, unauthenticated, deliberately narrow: aggregate counts only, nothing
 * that could identify a specific family, donor, or volunteer. Meant for the eventual public
 * "our impact" section of the customer site (not yet built — see the standing plan's F1/F2 hold).
 * "Families helped" counts a case once it has actually reached the family-visible completion
 * stages, not merely "assigned" or "in progress". */
export async function getPublicImpact() {
  const FAMILIES_HELPED_STATUSES: CaseStatus[] = ["CREMATION_COMPLETED", "DOCS_UPLOADED", "CLOSED"];

  const [familiesHelped, activeVolunteers, donationAgg, cities] = await Promise.all([
    Case.countDocuments({ status: { $in: FAMILIES_HELPED_STATUSES } }),
    Volunteer.countDocuments({ status: "ACTIVE" }),
    Donation.aggregate([{ $match: { status: "SUCCESS" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Case.distinct("city"),
  ]);

  return {
    familiesHelped,
    activeVolunteers,
    totalRaised: toRupees(donationAgg[0]?.total ?? 0),
    citiesServed: cities.length,
  };
}
