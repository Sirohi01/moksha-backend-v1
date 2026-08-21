import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { sendEmail } from "../../lib/email.service";

const SENSITIVE_KEYS = new Set(["password", "passwordHash", "token", "accessToken", "refreshToken", "signature"]);

type AdminFormDetails = Record<string, unknown>;

interface AdminFormEmailInput {
  formName: string;
  userName?: string;
  details: AdminFormDetails;
  submittedAt?: Date;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatLabel(key: string): string {
  return key
    .replace(/\./g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "N/A";
  if (value instanceof Date) return value.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(", ") : "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function flattenDetails(details: AdminFormDetails, prefix = ""): Array<[string, unknown]> {
  return Object.entries(details).flatMap(([key, value]) => {
    if (SENSITIVE_KEYS.has(key)) return [];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      return flattenDetails(value as AdminFormDetails, fullKey);
    }
    return [[fullKey, value]];
  });
}

function buildRows(details: AdminFormDetails): string {
  return flattenDetails(details)
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:34%;">${escapeHtml(formatLabel(key))}</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${escapeHtml(formatValue(value))}</td>
        </tr>`
    )
    .join("");
}

function buildHtml(input: Required<AdminFormEmailInput>): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
      <h2 style="margin:0 0 12px;">New ${escapeHtml(input.formName)} Submission</h2>
      <p style="margin:0 0 16px;color:#4b5563;">A new form submission was received from ${escapeHtml(input.userName)}.</p>
      <table style="border-collapse:collapse;width:100%;max-width:760px;font-size:14px;">
        <tbody>
          <tr>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:34%;">Form Name / Form Type</td>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;">${escapeHtml(input.formName)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Name</td>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;">${escapeHtml(input.userName)}</td>
          </tr>
          ${buildRows(input.details)}
          <tr>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Submission Date & Time</td>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;">${escapeHtml(formatValue(input.submittedAt))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export function sendAdminFormSubmissionEmail(input: AdminFormEmailInput): void {
  const userName = input.userName?.trim() || "Unknown User";
  const submittedAt = input.submittedAt ?? new Date();
  const subject = `New ${input.formName} Submission - ${userName}`;

  sendEmail({
    to: env.ADMIN_NOTIFICATION_EMAIL,
    subject,
    html: buildHtml({ ...input, userName, submittedAt }),
  }).catch((err) => {
    logger.error(`sendAdminFormSubmissionEmail(): failed for "${input.formName}"`, { err });
  });
}
