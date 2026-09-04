import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { processNotificationQueue } from "./lib/notificationQueue.service";
import { captureSnapshot } from "./lib/reportSnapshot.service";
import { runSystemServiceReminderSweep } from "./lib/systemServiceReminder.service";
import { runScheduledAudits } from "./modules/seo/seo.scheduler";

// PRD Phase E1 — 1 minute, so a notification on the shortest retry backoff step (also 1 minute)
// gets picked up promptly rather than sitting until the next longer-spaced sweep.
const NOTIFICATION_QUEUE_INTERVAL_MS = 60_000;
// PRD Phase F3 — hourly is plenty for a daily-bucketed trend snapshot; it just needs to be
// refreshed a few times before the calendar day rolls over.
const REPORT_SNAPSHOT_INTERVAL_MS = 60 * 60_000;
// Expiry is day-granularity, so hourly is plenty to catch a threshold crossing well within the
// same day it happens; the per-item dedupe guards keep repeated sweeps from double-firing.
const SYSTEM_SERVICE_REMINDER_INTERVAL_MS = 60 * 60_000;
// Scheduled SEO audits are hour-granular (schedule.hourUtc), so a 15-minute sweep picks a due
// audit up well inside its hour without hammering the crawler queue.
const SEO_AUDIT_SWEEP_INTERVAL_MS = 15 * 60_000;

async function start(): Promise<void> {
  await connectDB();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Moksha Sewa API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  processNotificationQueue().catch((err) => logger.error("notificationQueue: initial sweep failed", { err }));
  const notificationQueueTimer = setInterval(() => {
    processNotificationQueue().catch((err) => logger.error("notificationQueue: sweep failed", { err }));
  }, NOTIFICATION_QUEUE_INTERVAL_MS);

  captureSnapshot().catch((err) => logger.error("reportSnapshot: initial capture failed", { err }));
  const reportSnapshotTimer = setInterval(() => {
    captureSnapshot().catch((err) => logger.error("reportSnapshot: capture failed", { err }));
  }, REPORT_SNAPSHOT_INTERVAL_MS);

  runSystemServiceReminderSweep().catch((err) => logger.error("systemServiceReminder: initial sweep failed", { err }));
  const systemServiceReminderTimer = setInterval(() => {
    runSystemServiceReminderSweep().catch((err) => logger.error("systemServiceReminder: sweep failed", { err }));
  }, SYSTEM_SERVICE_REMINDER_INTERVAL_MS);

  const seoAuditTimer = setInterval(() => {
    runScheduledAudits().catch((err) => logger.error("seoScheduler: sweep failed", { err }));
  }, SEO_AUDIT_SWEEP_INTERVAL_MS);

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    clearInterval(notificationQueueTimer);
    clearInterval(reportSnapshotTimer);
    clearInterval(systemServiceReminderTimer);
    clearInterval(seoAuditTimer);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});
