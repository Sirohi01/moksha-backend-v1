import { ExternalService, IExternalService } from "../models/externalService.model";
import { getSettings } from "../modules/setting/setting.service";
import { notifyAdmins } from "./adminNotify.service";
import { sendEmail } from "./email.service";
import { renderEmailShell } from "./emailShell";
import { p, pLast, callout, warningCallout, detailRow, detailsBox, button, secondaryButton } from "./emailFragments";
import { env } from "../config/env";
import { logger } from "../config/logger";

const MS_PER_DAY = 86_400_000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysRemaining(expiryDate: Date): number {
  return Math.floor((expiryDate.getTime() - Date.now()) / MS_PER_DAY);
}

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function reminderSubject(item: IExternalService, remaining: number): string {
  if (remaining < 0) return `🔴 ${item.name} has expired — renew it now`;
  if (remaining === 0) return `⏰ ${item.name} expires today`;
  return `⏰ ${item.name} expires in ${remaining} day${remaining === 1 ? "" : "s"}`;
}

function reminderEmailHtml(item: IExternalService, remaining: number): string {
  const isExpired = remaining < 0;
  const manageUrl = `${env.ADMIN_CLIENT_URL}/system-services`;

  const headline = isExpired
    ? warningCallout(`This service expired ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} ago`)
    : callout(remaining === 0 ? "This service expires today" : `${remaining} day${remaining === 1 ? "" : "s"} left before this service expires`);

  const rows =
    detailRow("Service", item.name) +
    detailRow("Category", formatCategory(item.category)) +
    (item.provider ? detailRow("Provider", item.provider) : "") +
    (item.accountIdentifier ? detailRow("Account", item.accountIdentifier) : "") +
    detailRow("Expiry Date", item.expiryDate.toDateString());

  const buttons = (item.loginUrl ? secondaryButton(item.loginUrl, "Open Provider Dashboard") : "") + button(manageUrl, "Renew in System & Security");

  return (
    p(`Namaste,`) +
    p(
      isExpired
        ? `The service below has already expired and may stop working if it hasn't been renewed.`
        : `A tracked service is coming up for renewal soon — here are the details:`
    ) +
    headline +
    detailsBox(rows) +
    `<div style="margin:4px 0 18px 0;">${buttons}</div>` +
    pLast(`This is a routine reminder sent by the System &amp; Security expiry tracker on the admin panel.`)
  );
}

/**
 * Runs off a plain setInterval in server.ts (same "no cron/queue infra yet" convention as
 * notificationQueue.service.ts and reportSnapshot.service.ts) — sweeps every tracked external
 * service, raises an in-app bell notification once per day once it enters its popup threshold,
 * and sends an email reminder once per day once it enters its (separately configurable) email
 * threshold. Both dedupe guards are stamped per-item so a service that's been expiring for weeks
 * doesn't spam either channel more than once a day.
 */
export async function runSystemServiceReminderSweep(): Promise<void> {
  const [services, settings] = await Promise.all([ExternalService.find(), getSettings()]);
  if (services.length === 0) return;

  const defaults = settings.systemAlerts ?? { popupReminderDays: 15, emailReminderDays: 15, notifyEmails: [] };
  const today = todayKey();

  for (const item of services) {
    if (!item.remindersEnabled) continue;

    const remaining = daysRemaining(item.expiryDate);
    const popupThreshold = item.popupReminderDays ?? defaults.popupReminderDays;
    const emailThreshold = item.emailReminderDays ?? defaults.emailReminderDays;

    if (remaining <= popupThreshold && item.lastPopupNotifiedForDay !== today) {
      await notifyAdmins(
        "SYSTEM_EXPIRY",
        remaining < 0 ? `${item.name} has expired` : `${item.name} expires soon`,
        remaining < 0
          ? `Expired ${Math.abs(remaining)} day(s) ago — renew it in System & Security.`
          : `Expires in ${remaining} day(s) — renew it in System & Security.`,
        "/system-services"
      );
      item.lastPopupNotifiedForDay = today;
    }

    if (remaining <= emailThreshold && item.lastEmailSentForDay !== today) {
      const recipients = item.notifyEmails?.length ? item.notifyEmails : defaults.notifyEmails;
      if (recipients.length > 0) {
        const subject = reminderSubject(item, remaining);
        const html = renderEmailShell(reminderEmailHtml(item, remaining));
        await Promise.all(
          recipients.map((to) =>
            sendEmail({ to, subject, html }).catch((err) =>
              logger.error(`systemServiceReminder: email to ${to} failed for "${item.name}"`, { err })
            )
          )
        );
      } else {
        logger.warn(`systemServiceReminder: "${item.name}" is within its email threshold but has no recipients configured`);
      }
      item.lastEmailSentForDay = today;
    }

    if (item.isModified()) await item.save();
  }
}
