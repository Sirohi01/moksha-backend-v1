import { NotificationTemplate } from "../models/notificationTemplate.model";
import { NotificationLog, INotificationLog } from "../models/notificationLog.model";
import { Setting } from "../models/setting.model";
import { sendEmail } from "./email.service";
import { renderEmailShell } from "./emailShell";
import { logger } from "../config/logger";

interface NotifyRecipient {
  userId?: string;
  phone?: string;
  email?: string;
}

// PRD Phase E1 — 1m, 5m, 30m, 2h, 6h. Indexed by (attempts - 1) right after a failed attempt;
// once `attempts` reaches maxAttempts the entry is left FAILED with no further nextRetryAt.
const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MINUTES = [1, 5, 30, 120, 360];

function render(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? "");
}

/** Handles the overnight case (start > end, e.g. 21:00-08:00) as well as a same-day window. */
function isWithinQuietHours(now: Date, start?: string, end?: string): boolean {
  if (!start || !end) return false;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (startMinutes === endMinutes) return false; // degenerate config — treat as disabled

  return startMinutes < endMinutes
    ? nowMinutes >= startMinutes && nowMinutes < endMinutes
    : nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function endOfQuietHours(now: Date, end: string): Date {
  const [endH, endM] = end.split(":").map(Number);
  const result = new Date(now);
  result.setHours(endH, endM, 0, 0);
  if (result <= now) result.setDate(result.getDate() + 1);
  return result;
}

/**
 * Sends (or re-sends) one notification and updates its own NotificationLog entry in place — the
 * single place that actually calls sendEmail(). Used both by notify()'s first attempt and by
 * notificationQueue.service.ts's retry sweep, so a failure handled here always goes through the
 * same backoff/give-up logic regardless of which caller triggered it. Re-fetches the template
 * fresh every time (never trusts anything cached on the log entry) so an edited template is
 * honored even on a retry hours after the original request. Never throws — every failure path
 * ends in a saved log entry, not a rejected promise.
 */
export async function attemptDelivery(log: INotificationLog): Promise<void> {
  try {
    const template = await NotificationTemplate.findOne({ key: log.templateKey, isActive: true });
    if (!template) {
      log.status = "FAILED";
      log.error = "Template is no longer active";
      log.nextRetryAt = undefined;
      await log.save();
      return;
    }

    if (!log.email) throw new Error("No email address on file for this recipient");

    await sendEmail({
      to: log.email,
      subject: template.subject ? render(template.subject, log.variables ?? {}) : "Moksha Sewa",
      html: renderEmailShell(render(template.body, log.variables ?? {})),
    });

    log.status = "SENT";
    log.error = undefined;
    log.nextRetryAt = undefined;
    await log.save();
  } catch (err) {
    log.attempts += 1;
    log.error = err instanceof Error ? err.message : "Unknown error";
    log.status = "FAILED";

    if (log.attempts >= log.maxAttempts) {
      log.nextRetryAt = undefined;
      logger.error(`notify(): giving up on "${log.templateKey}" after ${log.attempts} attempt(s)`, { error: log.error });
    } else {
      log.nextRetryAt = new Date(Date.now() + RETRY_BACKOFF_MINUTES[log.attempts - 1] * 60_000);
      logger.warn(
        `notify(): attempt ${log.attempts} failed for "${log.templateKey}" — retrying at ${log.nextRetryAt.toISOString()}`,
        { error: log.error }
      );
    }

    await log.save().catch((saveErr) => {
      logger.error("notify(): failed to persist a delivery failure", { saveErr });
    });
  }
}

/**
 * PRD §17.1 — the single call site for every outbound notification, replacing the ad-hoc
 * sendEmail()/dispatchOtp() calls that used to be scattered across service files. Looks up the
 * template, decides whether this send happens now or is deferred to the end of quiet hours, then
 * hands off to attemptDelivery() — but never throws itself: a notification failing must never
 * fail the operation that triggered it (same principle already applied to the welcome email and
 * the audit log).
 *
 * WhatsApp delivery is intentionally not wired to arbitrary template bodies yet — AiSensy (and
 * WhatsApp Business generally) requires each message template to be pre-approved by Meta before
 * it can be sent, which is an operational setup step outside this codebase, not something that
 * can be safely auto-wired. The schema supports channel "WHATSAPP"/"BOTH" so this can be filled
 * in later without a migration; for now that half of a BOTH-channel template is skipped and logged.
 */
export async function notify(
  templateKey: string,
  recipient: NotifyRecipient,
  variables: Record<string, string> = {},
  options: { waitForDelivery?: boolean } = {}
): Promise<void> {
  try {
    const template = await NotificationTemplate.findOne({ key: templateKey, isActive: true });
    if (!template) {
      logger.warn(`notify(): no active template for key "${templateKey}" — skipping`);
      return;
    }

    if (template.channel === "WHATSAPP" || template.channel === "BOTH") {
      logger.warn(`notify(): WHATSAPP channel not yet wired for arbitrary templates (key "${templateKey}") — skipping`);
    }

    const wantsEmail = template.channel === "EMAIL" || template.channel === "BOTH";
    if (!wantsEmail) return; // WHATSAPP-only template — nothing left this call can do today.

    if (!recipient.email) {
      await NotificationLog.create({
        userId: recipient.userId,
        phone: recipient.phone,
        channel: template.channel,
        category: template.category,
        templateKey,
        variables,
        status: "INVALID",
        error: "No email address on file for this recipient",
        attempts: 0,
        maxAttempts: 0,
      });
      return;
    }

    const settings = await Setting.findOne().select("notifications");
    const now = new Date();
    const quietHoursEnd = settings?.notifications?.quietHoursEnd;
    const deferUntil =
      template.category === "MARKETING" && quietHoursEnd && isWithinQuietHours(now, settings?.notifications?.quietHoursStart, quietHoursEnd)
        ? endOfQuietHours(now, quietHoursEnd)
        : null;

    const log = await NotificationLog.create({
      userId: recipient.userId,
      phone: recipient.phone,
      email: recipient.email,
      channel: template.channel,
      category: template.category,
      templateKey,
      variables,
      status: "QUEUED",
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextRetryAt: deferUntil ?? undefined,
    });

    if (deferUntil) {
      logger.info(`notify(): "${templateKey}" deferred until quiet hours end (${deferUntil.toISOString()})`);
      return; // notificationQueue.service.ts's sweep picks this up once nextRetryAt arrives
    }

    // Deliberately NOT awaited — attemptDelivery() does a real SMTP round-trip (often 1-3s, more
    // under any network strain), and notify()'s callers are always request handlers doing this
    // inline (a status change, an expense decision, a staff invite). Awaiting it here would mean
    // every one of those API calls stays blocked until the email either sends or fails, directly
    // contradicting this function's own "never slows down the caller" contract. attemptDelivery()
    // already never throws — it catches everything and persists the outcome to the log entry —
    // so this is a pure background fire-and-forget, not a dropped error path.
    const delivery = attemptDelivery(log);
    if (options.waitForDelivery) {
      await delivery;
      return;
    }

    delivery.catch((err) => {
      logger.error(`notify(): unexpected failure delivering "${templateKey}"`, { err });
    });
  } catch (err) {
    logger.error(`notify(): unexpected failure for template "${templateKey}"`, { err });
  }
}
