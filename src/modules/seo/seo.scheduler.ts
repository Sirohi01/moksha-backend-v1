import { logger } from "../../config/logger";
import { SeoSite, ISeoSchedule } from "../../models/seoSite.model";
import { AuditInProgressError, runSeoAudit } from "./seo.orchestrator";

let sweepRunning = false;

export function computeNextRun(schedule: ISeoSchedule, from = new Date()): Date {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(schedule.hourUtc);

  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);

  if (schedule.frequency === "weekly") {
    const daysAhead = (schedule.dayOfWeek - next.getUTCDay() + 7) % 7;
    if (daysAhead > 0) next.setUTCDate(next.getUTCDate() + daysAhead);
  } else if (schedule.frequency === "monthly") {
    if (next.getUTCDate() !== 1) {
      next.setUTCMonth(next.getUTCMonth() + 1, 1);
    }
  }

  return next;
}

/** Sweep driven by the server's interval timer, matching the existing notification-queue and
 *  report-snapshot sweeps. A module-level guard keeps overlapping ticks from queuing duplicates. */
export async function runScheduledAudits(): Promise<void> {
  if (sweepRunning) return;
  sweepRunning = true;

  try {
    const now = new Date();
    const sites = await SeoSite.find({ isActive: true, "schedule.enabled": true });

    for (const site of sites) {
      const nextRunAt = site.schedule.nextRunAt;

      if (!nextRunAt) {
        site.schedule.nextRunAt = computeNextRun(site.schedule, now);
        await site.save();
        continue;
      }

      if (nextRunAt > now) continue;

      try {
        logger.info("seoScheduler: starting scheduled audit", { siteId: String(site._id), url: site.url });
        await runSeoAudit(site._id, { trigger: "scheduled" });
      } catch (error) {
        if (error instanceof AuditInProgressError) {
          logger.info("seoScheduler: audit already running, skipping", { siteId: String(site._id) });
          continue;
        }
        logger.error("seoScheduler: scheduled audit failed", { siteId: String(site._id), err: error });
      }

      const fresh = await SeoSite.findById(site._id);
      if (!fresh) continue;
      fresh.schedule.lastRunAt = new Date();
      fresh.schedule.nextRunAt = computeNextRun(fresh.schedule, new Date());
      await fresh.save();
    }
  } catch (error) {
    logger.error("seoScheduler: sweep failed", { err: error });
  } finally {
    sweepRunning = false;
  }
}
