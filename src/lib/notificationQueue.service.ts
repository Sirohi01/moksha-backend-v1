import { NotificationLog } from "../models/notificationLog.model";
import { attemptDelivery } from "./notify.service";
import { logger } from "../config/logger";

/**
 * PRD Phase E1 — sweeps NotificationLog for anything due right now: a failed send whose backoff
 * window has elapsed, or a MARKETING send that was deferred past quiet hours. There's no
 * cron/queue infra in this codebase yet (the same constraint already documented on
 * case.service.ts's SLA breach sweep) — this runs off a plain setInterval in server.ts instead of
 * a separate worker process, which is enough at this app's scale.
 */
export async function processNotificationQueue(): Promise<number> {
  const due = await NotificationLog.find({
    status: { $in: ["QUEUED", "FAILED"] },
    nextRetryAt: { $lte: new Date() },
    $expr: { $lt: ["$attempts", "$maxAttempts"] },
  }).limit(50);

  for (const log of due) {
    await attemptDelivery(log);
  }

  if (due.length > 0) {
    logger.info(`notificationQueue: processed ${due.length} due notification(s)`);
  }

  return due.length;
}
