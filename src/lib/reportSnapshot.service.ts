import { Case } from "../models/case.model";
import { AssistanceRequest } from "../models/assistanceRequest.model";
import { Volunteer } from "../models/volunteer.model";
import { Donation } from "../models/donation.model";
import { ReportSnapshot } from "../models/reportSnapshot.model";
import { CASE_STATUSES, CaseStatus } from "../utils/constants";
import { toRupees } from "../utils/money";

const OPEN_CASE_STATUSES: CaseStatus[] = CASE_STATUSES.filter(
  (s) => s !== "CLOSED" && s !== "REJECTED" && s !== "CANCELLED"
);

/** "YYYY-MM-DD" in server-local time — a plain string sorts/compares correctly as long as every
 * caller formats it the same way, which is simpler than storing a Date and normalizing timezones
 * for a value that's only ever used as a calendar-day bucket key. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * PRD Phase F3 — captures (or refreshes) today's cumulative snapshot row. Safe to call
 * repeatedly: `date` is the upsert key, so today's row just gets overwritten with fresher totals
 * until the calendar date rolls over and a new row starts. Deliberately cumulative-as-of-today
 * rather than a daily delta — see reportSnapshot.model.ts's doc comment for why.
 */
export async function captureSnapshot(): Promise<void> {
  const [totalCases, openCases, closedCases, criticalCases, totalRequests, pendingRequests, totalVolunteers, activeVolunteers, donationAgg] =
    await Promise.all([
      Case.countDocuments(),
      Case.countDocuments({ status: { $in: OPEN_CASE_STATUSES } }),
      Case.countDocuments({ status: "CLOSED" }),
      Case.countDocuments({ priority: "CRITICAL", status: { $in: OPEN_CASE_STATUSES } }),
      AssistanceRequest.countDocuments(),
      AssistanceRequest.countDocuments({ status: "SUBMITTED" }),
      Volunteer.countDocuments(),
      Volunteer.countDocuments({ status: "ACTIVE" }),
      Donation.aggregate([
        { $match: { status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

  const today = dateKey(new Date());
  await ReportSnapshot.findOneAndUpdate(
    { date: today },
    {
      date: today,
      cases: { total: totalCases, open: openCases, closed: closedCases, critical: criticalCases },
      requests: { total: totalRequests, pending: pendingRequests },
      volunteers: { total: totalVolunteers, active: activeVolunteers },
      donations: { totalRaised: toRupees(donationAgg[0]?.total ?? 0), totalDonations: donationAgg[0]?.count ?? 0 },
    },
    { upsert: true }
  );
}
