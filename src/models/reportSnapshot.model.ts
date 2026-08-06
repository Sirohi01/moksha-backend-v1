import { Schema, model, Document } from "mongoose";

/** PRD Phase F3 — one row per calendar day, holding cumulative totals *as of that day* (not a
 * delta) — so "today vs N days ago" trend charts are just two array reads, no extra subtraction
 * logic downstream. report.service.ts's getOverview() stays the live, always-current source of
 * truth for "right now"; this is purely for historical trend lines the live query can't answer
 * (it has no memory of what the numbers were last week). Captured by reportSnapshot.service.ts on
 * an hourly interval (same no-cron-infra convention as the notification queue) — safe to
 * over-write today's own row repeatedly since `date` is the upsert key. */
export interface IReportSnapshot extends Document {
  date: string; // "YYYY-MM-DD", local server date
  cases: { total: number; open: number; closed: number; critical: number };
  requests: { total: number; pending: number };
  volunteers: { total: number; active: number };
  donations: { totalRaised: number; totalDonations: number };
  createdAt: Date;
  updatedAt: Date;
}

const reportSnapshotSchema = new Schema<IReportSnapshot>(
  {
    date: { type: String, required: true, unique: true, index: true },
    cases: {
      total: { type: Number, default: 0 },
      open: { type: Number, default: 0 },
      closed: { type: Number, default: 0 },
      critical: { type: Number, default: 0 },
    },
    requests: {
      total: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
    },
    volunteers: {
      total: { type: Number, default: 0 },
      active: { type: Number, default: 0 },
    },
    donations: {
      totalRaised: { type: Number, default: 0 },
      totalDonations: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const ReportSnapshot = model<IReportSnapshot>("ReportSnapshot", reportSnapshotSchema);
