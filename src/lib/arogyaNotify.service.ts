import nodemailer from "nodemailer";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";
import { resolveOtpConfig, resolveSmtpConfig } from "./integrationConfig.service";

/**
 * Organisation-aware email/WhatsApp sending for Arogya — deliberately separate from
 * lib/email.service.ts and lib/otp/, which are both hardcoded to Moksha's own unprefixed env
 * vars (see integrationConfig.service.ts / UNIFIED_PLATFORM_STATE.md §B "no cross-organisation
 * credential fallback, ever"). Every call here resolves AROGYA_* credentials fresh — there is no
 * path by which an Arogya email/WhatsApp send can silently use Moksha's SMTP/AiSensy account.
 *
 * The HTML templates below are copied byte-for-byte in structure/branding from the real legacy
 * backend-arogya/services/delegate/emailService.js (sendOtpEmail/sendThankYouEmail/
 * sendGroupThankYouEmail/sendAdminLeadEmail) — that source never had a real assets/logo.png
 * (fs.existsSync was always false in production), so the "no logo" fallback heading branch is
 * what actually shipped, and is what's reproduced here — not a guess, not an improvement.
 */

async function getTransporter() {
  const smtp = resolveSmtpConfig("AROGYA"); // throws ApiError.internal if not configured — fail closed, no fallback
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  return { transporter, smtp };
}

export async function sendArogyaEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
  const { transporter, smtp } = await getTransporter();
  await transporter.sendMail({ from: `"${smtp.fromName}" <${smtp.fromEmail}>`, to, subject, html, text });
}

const LOGO_HEADING_HTML =
  `<h1 style="margin: 0; color: #36682e; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-align: center;">Arogya Sangosthi</h1>`;

const EMAIL_WRAPPER_OPEN = (title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7f4; font-family: Arial, Helvetica, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f7f4; padding: 15px 5px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; max-width: 600px; width: 100%;">
                    <tr>
                        <td align="center" style="padding: 18px 15px; border-bottom: 3px solid #36682e; background-color: #ffffff;">
                            ${LOGO_HEADING_HTML}
                        </td>
                    </tr>`;

const EMAIL_WRAPPER_CLOSE = `
                    <tr>
                        <td align="center" style="padding: 12px 15px; background-color: #f9fbf9; border-top: 1px solid #eeeeee;">
                            <p style="margin: 0; color: #888888; font-size: 11.5px;">Namo Gange Trust • 18th Integrated Arogya Sangosthi 2026</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

const FOOTER_BLOCK = `
                            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0 0 14px 0;">
                            <p style="font-size: 12.5px; line-height: 1.4; margin: 0; color: #333333;">
                                Warm Regards,<br>
                                <strong>Team Namo Gange Trust</strong><br>
                                <a href="https://arogya.namogange.org/" style="color: #36682e; text-decoration: underline;">https://arogya.namogange.org/</a>
                            </p>`;

const DAY_DATE_MAP: Record<number, string> = { 1: "Day 1 (21 Aug 2026)", 2: "Day 2 (22 Aug 2026)", 3: "Day 3 (23 Aug 2026)" };

function formatDaysText(selectedDays: number[]): string {
  const days = [...selectedDays].sort((a, b) => a - b);
  if (days.length === 3) return "All Days (21, 22, 23 Aug 2026)";
  if (days.length > 0) return days.map((d) => DAY_DATE_MAP[d] || `Day ${d}`).join(", ");
  return "All Days (21, 22, 23 Aug 2026)";
}

function generateQrUrl(lines: string[]): string {
  const text = lines.join("\n");
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=1&ecc=M&data=${encodeURIComponent(text)}`;
}

export async function sendArogyaOtpEmail(email: string, fullName: string, otp: string): Promise<void> {
  const html = `${EMAIL_WRAPPER_OPEN("Your Secure Verification Code - Arogya Sangosthi 2026")}
                    <tr>
                        <td style="padding: 20px 15px; color: #333333;">
                            <p style="font-size: 15px; font-weight: 700; color: #204e1f; margin: 0 0 8px 0;"><span style="white-space: nowrap;">Namo Gange Namaskar! 🙏</span></p>
                            <p style="font-size: 13.5px; margin: 0 0 10px 0; color: #4a4a4a; line-height: 1.4;">Dear <strong>${fullName}</strong>,</p>
                            <p style="font-size: 13.5px; line-height: 1.5; margin: 0 0 15px 0; color: #4a4a4a;">
                                Thank you for initiating your Delegate Registration for the <strong>18th Integrated Arogya Sangosthi 2026</strong>. To proceed, please use the following secure verification code (OTP):
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; background-color: #f0f7f1; border: 1.5px dashed #36682e; border-radius: 6px; padding: 15px; text-align: center;">
                                <tr>
                                    <td align="center">
                                        <span style="font-size: 11px; font-weight: 700; color: #204e1f; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 6px;">VERIFICATION CODE</span>
                                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1b5e20; display: block; margin-left: 8px;">${otp}</span>
                                    </td>
                                </tr>
                            </table>
                            <p style="font-size: 13px; color: #4a4a4a; line-height: 1.5; margin: 0 0 10px 0;">⏳ This code is valid for <strong>10 minutes</strong>.</p>
                            <p style="font-size: 12.5px; color: #666666; line-height: 1.5; margin: 0 0 20px 0;">🔒 For your security, please never share your OTP with anyone. If you did not request this verification, please ignore this email.</p>
                            ${FOOTER_BLOCK}
                        </td>
                    </tr>${EMAIL_WRAPPER_CLOSE}`;

  await sendArogyaEmail(
    email,
    "Your Secure Verification Code for Arogya Sangosthi 2026 🌿",
    html,
    `Namo Gange Namaskar!\n\nDear ${fullName},\n\nThank you for initiating your Delegate Registration for Arogya Sangosthi 2026.\n\nTo proceed, please use the following secure verification code (OTP): ${otp}\n\nThis code is valid for 10 minutes.\n\nWarm Regards,\nTeam Arogya Sangosthi\nwww.arogyasangosthi.com`
  );
}

interface ThankYouData {
  delegateId: string;
  fullName: string;
  email: string;
  mobile: string;
  designation?: string;
  organization?: string;
  passName: string;
  amountRupees: number;
  selectedDays: number[];
  paymentMode: string;
}

export async function sendArogyaThankYouEmail(data: ThankYouData): Promise<void> {
  const formattedDays = formatDaysText(data.selectedDays);
  const displayPrice = `₹${data.amountRupees.toLocaleString("en-IN")}`;
  const qrUrl = generateQrUrl([
    "DELEGATE PASS (SINGLE)",
    `Delegate ID: ${data.delegateId}`,
    `Name: ${data.fullName}`,
    `Mobile: ${data.mobile}`,
    `Email: ${data.email}`,
    `Pass: ${data.passName}`,
    `Days: ${formattedDays}`,
    `Amount: ${displayPrice}`,
    "Status: VERIFIED",
  ]);

  const html = `${EMAIL_WRAPPER_OPEN("Registration Confirmed - 18th Integrated Arogya Sangosthi 2026")}
                    <tr>
                        <td style="padding: 20px 15px; color: #333333;">
                            <p style="font-size: 15px; font-weight: 700; color: #204e1f; margin: 0 0 8px 0;"><span style="white-space: nowrap;">Namo Gange Namaskar! 🙏</span></p>
                            <p style="font-size: 13.5px; margin: 0 0 10px 0; color: #4a4a4a; line-height: 1.4;">Dear <strong>${data.fullName}</strong>,</p>
                            <p style="font-size: 13.5px; line-height: 1.5; margin: 0 0 15px 0; color: #4a4a4a;">We are delighted to confirm your registration for the <strong>18th Integrated Arogya Sangosthi 2026</strong>, organized by Namo Gange Trust.</p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; border: 1px solid #d4ebd3; background-color: #f6faf6; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 12px 14px;">
                                        <h4 style="margin: 0 0 10px 0; color: #204e1f; font-size: 14.5px; border-bottom: 2px solid #36682e; padding-bottom: 4px;">📋 Registration Details</h4>
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11.5px; color: #333333; border-collapse: collapse;">
                                            <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap; width: 110px;">Registration ID:</td><td style="padding: 4px 0; font-family: monospace; font-weight: 700; color: #1b5e20;">${data.delegateId}</td></tr>
                                            <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Full Name:</td><td style="padding: 4px 0; font-weight: 600; color: #111111;">${data.fullName}</td></tr>
                                            <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Email Address:</td><td style="padding: 4px 0; color: #111111;">${data.email}</td></tr>
                                            <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Mobile Number:</td><td style="padding: 4px 0; color: #111111;">${data.mobile}</td></tr>
                                            ${data.designation ? `<tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Designation:</td><td style="padding: 4px 0; color: #111111;">${data.designation}</td></tr>` : ""}
                                            ${data.organization ? `<tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Organization:</td><td style="padding: 4px 0; color: #111111;">${data.organization}</td></tr>` : ""}
                                            <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Pass Selected:</td><td style="padding: 4px 0; font-weight: 700; color: #204e1f;">${data.passName}</td></tr>
                                            <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Conference Days:</td><td style="padding: 4px 0; font-weight: 600; color: #111111;">${formattedDays}</td></tr>
                                            <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Amount Paid:</td><td style="padding: 4px 0; font-weight: 700; color: #1b5e20;">${displayPrice}</td></tr>
                                            <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Payment Mode:</td><td style="padding: 4px 0; font-weight: 700; color: #36682e;">${data.paymentMode}</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; background-color: #f0f7f1; border: 1.5px dashed #36682e; border-radius: 6px; padding: 12px; text-align: center;">
                                <tr><td align="center">
                                    <p style="margin: 0 0 4px 0; color: #204e1f; font-size: 13.5px; font-weight: 700;">🎫 Your Official Conference Entry QR Code</p>
                                    <p style="margin: 0 0 10px 0; color: #555555; font-size: 11.5px;">Please present this QR Code at the venue counter for instant verification &amp; badge collection.</p>
                                    <img src="${qrUrl}" alt="Delegate QR Code" width="140" height="140" style="display: block; width: 140px; height: 140px; border: 2px solid #36682e; border-radius: 6px; padding: 4px; background-color: #ffffff; margin: 0 auto;" />
                                    <p style="margin: 6px 0 0 0; font-family: monospace; font-size: 11.5px; font-weight: 700; color: #1b5e20;">${data.delegateId}</p>
                                </td></tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; background-color: #ffffff; padding: 12px; border: 1px solid #e0e0e0; border-left: 4px solid #36682e;">
                                <tr><td>
                                    <h4 style="margin: 0 0 5px 0; color: #204e1f; font-size: 13.5px;">📍 Event Location &amp; Dates:</h4>
                                    <p style="margin: 0 0 3px 0; font-size: 12.5px; color: #333333;"><strong>Venue:</strong> Pragati Maidan, New Delhi</p>
                                    <p style="margin: 0 0 3px 0; font-size: 12.5px; color: #333333;"><strong>Dates:</strong> 21, 22, 23 August 2026</p>
                                    <p style="margin: 0; font-size: 12.5px; color: #333333;"><strong>Reporting Time:</strong> 09:00 AM onwards (IST)</p>
                                </td></tr>
                            </table>
                            <p style="font-size: 12.5px; line-height: 1.5; margin: 0 0 10px 0; color: #4a4a4a;">📌 <strong>Important:</strong> Please present your Registration ID (<strong>${data.delegateId}</strong>) at the registration counter at <strong>Pragati Maidan</strong> to collect your official Conference Badge &amp; Kit.</p>
                            <p style="font-size: 12.5px; line-height: 1.5; margin: 0 0 16px 0; color: #4a4a4a;">For any queries, reach out to us at <a href="mailto:info@arogyasangosthi.com" style="color: #36682e; text-decoration: underline;">info@arogyasangosthi.com</a>.</p>
                            ${FOOTER_BLOCK}
                        </td>
                    </tr>${EMAIL_WRAPPER_CLOSE}`;

  await sendArogyaEmail(
    data.email,
    `Registration Confirmed - 18th Integrated Arogya Sangosthi 2026 [Reg ID: ${data.delegateId}]`,
    html,
    `Namo Gange Namaskar ${data.fullName}!\n\nThank you for registering for the 18th Integrated Arogya Sangosthi 2026.\n\nRegistration ID: ${data.delegateId}\nPass Selected: ${data.passName}\nAmount Paid: ${displayPrice}\n\nVenue: Pragati Maidan, New Delhi\nDates: 21, 22, 23 August 2026`
  );
}

interface GroupMember { fullName: string; email?: string; mobile: string; designation?: string }
interface GroupThankYouData {
  groupId: string;
  primaryContactName: string;
  organization?: string;
  passName: string;
  amountRupees: number;
  selectedDays: number[];
  members: GroupMember[];
  primaryEmail: string;
}

export async function sendArogyaGroupThankYouEmail(data: GroupThankYouData): Promise<void> {
  const formattedDays = formatDaysText(data.selectedDays);
  const displayTotal = `₹${data.amountRupees.toLocaleString("en-IN")}`;
  const qrUrl = generateQrUrl([
    `DELEGATE PASS (GROUP - ${data.members.length} Members)`,
    `Delegate ID: ${data.groupId}`,
    `Primary: ${data.primaryContactName}`,
    `Pass: ${data.passName}`,
    `Days: ${formattedDays}`,
    `Total Amount: ${displayTotal}`,
    `Members: ${data.members.map((m) => m.fullName).join(", ")}`,
    "Status: VERIFIED",
  ]);

  const html = `${EMAIL_WRAPPER_OPEN("Group Registration Confirmed - 18th Integrated Arogya Sangosthi 2026")}
                    <tr>
                        <td style="padding: 20px 15px; color: #333333;">
                            <p style="font-size: 15px; font-weight: 700; color: #204e1f; margin: 0 0 8px 0;"><span style="white-space: nowrap;">Namo Gange Namaskar! 🙏</span></p>
                            <p style="font-size: 13.5px; margin: 0 0 10px 0; color: #4a4a4a; line-height: 1.4;">Dear <strong>${data.primaryContactName}</strong>,</p>
                            <p style="font-size: 13.5px; line-height: 1.5; margin: 0 0 15px 0; color: #4a4a4a;">We are pleased to confirm the group registration${data.organization ? ` for <strong>${data.organization}</strong>` : ""} for the <strong>18th Integrated Arogya Sangosthi 2026</strong>, organized by Namo Gange Trust.</p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; border: 1px solid #d4ebd3; background-color: #f6faf6; border-radius: 6px;">
                                <tr><td style="padding: 12px 14px;">
                                    <h4 style="margin: 0 0 10px 0; color: #204e1f; font-size: 14.5px; border-bottom: 2px solid #36682e; padding-bottom: 4px;">📋 Group Summary Details</h4>
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11.5px; color: #333333; border-collapse: collapse;">
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap; width: 110px;">Group Reg ID:</td><td style="padding: 4px 0; font-family: monospace; font-weight: 700; color: #1b5e20;">${data.groupId}</td></tr>
                                        ${data.organization ? `<tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Organization:</td><td style="padding: 4px 0; font-weight: 600; color: #111111;">${data.organization}</td></tr>` : ""}
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Primary Contact:</td><td style="padding: 4px 0; font-weight: 600; color: #111111;">${data.primaryContactName}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Total Delegates:</td><td style="padding: 4px 0; font-weight: 700; color: #204e1f;">${data.members.length} Person(s)</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Pass Selected:</td><td style="padding: 4px 0; font-weight: 700; color: #204e1f;">${data.passName}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Conference Days:</td><td style="padding: 4px 0; font-weight: 600; color: #111111;">${formattedDays}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Total Amount Paid:</td><td style="padding: 4px 0; font-weight: 700; color: #1b5e20;">${displayTotal}</td></tr>
                                    </table>
                                </td></tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; background-color: #f0f7f1; border: 1.5px dashed #36682e; border-radius: 6px; padding: 12px; text-align: center;">
                                <tr><td align="center">
                                    <p style="margin: 0 0 4px 0; color: #204e1f; font-size: 13.5px; font-weight: 700;">🎫 Group Official Entry QR Code</p>
                                    <p style="margin: 0 0 10px 0; color: #555555; font-size: 11.5px;">Please show this QR Code at the registration desk for group verification.</p>
                                    <img src="${qrUrl}" alt="Group Entry QR Code" width="140" height="140" style="display: block; width: 140px; height: 140px; border: 2px solid #36682e; border-radius: 6px; padding: 4px; background-color: #ffffff; margin: 0 auto;" />
                                    <p style="margin: 6px 0 0 0; font-family: monospace; font-size: 11.5px; font-weight: 700; color: #1b5e20;">${data.groupId}</p>
                                </td></tr>
                            </table>
                            ${data.members.length > 0 ? `
                            <h4 style="margin: 0 0 10px 0; color: #204e1f; font-size: 15px;">👥 Registered Group Delegates:</h4>
                            <table border="1" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #e0e0e0; font-size: 13px; margin-bottom: 20px; color: #333333;">
                                <thead><tr style="background-color: #f0f7f1; color: #204e1f;"><th align="center" width="10%">#</th><th align="left">Name</th><th align="left">Designation</th><th align="left">Mobile</th></tr></thead>
                                <tbody>${data.members.map((m, i) => `<tr><td align="center" style="font-weight: bold;">${i + 1}</td><td style="font-weight: 600;">${m.fullName}</td><td>${m.designation || "N/A"}</td><td>${m.mobile || "N/A"}</td></tr>`).join("")}</tbody>
                            </table>` : ""}
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; border-left: 4px solid #36682e;">
                                <tr><td>
                                    <h4 style="margin: 0 0 8px 0; color: #204e1f; font-size: 15px;">📍 Event Location &amp; Dates:</h4>
                                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #333333;"><strong>Venue:</strong> Pragati Maidan, New Delhi</p>
                                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #333333;"><strong>Dates:</strong> 21, 22, 23 August 2026</p>
                                    <p style="margin: 0; font-size: 14px; color: #333333;"><strong>Reporting Time:</strong> 09:00 AM onwards (IST)</p>
                                </td></tr>
                            </table>
                            <p style="font-size: 14px; line-height: 1.6; margin: 0 0 15px 0; color: #4a4a4a;">📌 <strong>Important:</strong> Please present your Group Registration ID (<strong>${data.groupId}</strong>) at the registration counter at <strong>Pragati Maidan</strong> to collect passes and conference kits for all delegates.</p>
                            <p style="font-size: 14px; line-height: 1.6; margin: 0 0 25px 0; color: #4a4a4a;">For any queries, reach out to us at <a href="mailto:info@arogyasangosthi.com" style="color: #36682e; text-decoration: underline;">info@arogyasangosthi.com</a>.</p>
                            ${FOOTER_BLOCK}
                        </td>
                    </tr>${EMAIL_WRAPPER_CLOSE}`;

  await sendArogyaEmail(
    data.primaryEmail,
    `Group Registration Confirmed - 18th Integrated Arogya Sangosthi 2026 [Group ID: ${data.groupId}]`,
    html,
    `Namo Gange Namaskar ${data.primaryContactName}!\n\nGroup registration confirmed${data.organization ? ` for ${data.organization}` : ""}.\n\nGroup ID: ${data.groupId}\nTotal Delegates: ${data.members.length}\nPass Selected: ${data.passName}\nTotal Paid: ${displayTotal}\n\nVenue: Pragati Maidan, New Delhi\nDates: 21, 22, 23 August 2026`
  );
}

interface AdminLeadData {
  delegateId: string;
  fullName: string;
  email: string;
  mobile: string;
  designation?: string;
  organization?: string;
  passName: string;
  amountRupees: number;
  selectedDays: number[];
  paymentMode: string;
  isGroup: boolean;
  members?: GroupMember[];
}

/** Sent to Arogya's own configured SMTP FROM_EMAIL (per user decision 2026-08-26) — the legacy
 * system hardcoded this to a specific developer's personal Gmail address, which is not something
 * to carry into the new system without an explicit decision on the real recipient. */
export async function sendArogyaAdminLeadEmail(data: AdminLeadData): Promise<void> {
  const { fromEmail } = resolveSmtpConfig("AROGYA");
  const formattedDays = formatDaysText(data.selectedDays);
  const displayPrice = `₹${data.amountRupees.toLocaleString("en-IN")}`;
  const registeredAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const html = `${EMAIL_WRAPPER_OPEN("New Delegate Registration Lead - 18th Integrated Arogya Sangosthi 2026")}
                    <tr>
                        <td style="padding: 20px 15px; color: #333333;">
                            <p style="font-size: 15px; font-weight: 700; color: #204e1f; margin: 0 0 8px 0;"><span style="white-space: nowrap;">Namo Gange Namaskar! 🙏</span></p>
                            <p style="font-size: 13.5px; margin: 0 0 10px 0; color: #4a4a4a; line-height: 1.4;">Dear <strong>Admin</strong>,</p>
                            <p style="font-size: 13.5px; line-height: 1.5; margin: 0 0 15px 0; color: #4a4a4a;">A new <strong>${data.isGroup ? "Group Registration Lead" : "Single Registration Lead"}</strong> has been recorded in the system. Below are the registration details:</p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; border: 1px solid #d4ebd3; background-color: #f6faf6; border-radius: 6px;">
                                <tr><td style="padding: 12px 14px;">
                                    <h4 style="margin: 0 0 10px 0; color: #204e1f; font-size: 14.5px; border-bottom: 2px solid #36682e; padding-bottom: 4px;">📋 ${data.isGroup ? "Group Lead Details" : "Registration Details"}</h4>
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11.5px; color: #333333; border-collapse: collapse;">
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap; width: 140px;">Delegate ID:</td><td style="padding: 4px 0; font-family: monospace; font-weight: 700; color: #1b5e20;">${data.delegateId}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Name:</td><td style="padding: 4px 0; font-weight: 600; color: #111111;">${data.fullName}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Email Address:</td><td style="padding: 4px 0; color: #111111;">${data.email}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Mobile Number:</td><td style="padding: 4px 0; color: #111111;">${data.mobile}</td></tr>
                                        ${data.designation ? `<tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Designation:</td><td style="padding: 4px 0; color: #111111;">${data.designation}</td></tr>` : ""}
                                        ${data.organization ? `<tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Organization:</td><td style="padding: 4px 0; color: #111111;">${data.organization}</td></tr>` : ""}
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Pass Selected:</td><td style="padding: 4px 0; font-weight: 700; color: #204e1f;">${data.passName}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Conference Days:</td><td style="padding: 4px 0; font-weight: 600; color: #111111;">${formattedDays}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Amount Paid:</td><td style="padding: 4px 0; font-weight: 700; color: #1b5e20;">${displayPrice}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Payment Mode:</td><td style="padding: 4px 0; font-weight: 700; color: #36682e;">${data.paymentMode}</td></tr>
                                        <tr><td style="padding: 4px 6px 4px 0; color: #555555; font-weight: 600; white-space: nowrap;">Registration Date:</td><td style="padding: 4px 0; color: #111111;">${registeredAt}</td></tr>
                                    </table>
                                </td></tr>
                            </table>
                            ${data.isGroup && data.members && data.members.length > 0 ? `
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 15px; border: 1px solid #d4ebd3; background-color: #ffffff; border-radius: 6px; padding: 10px;">
                                <tr><td>
                                    <h4 style="margin: 0 0 8px 0; color: #204e1f; font-size: 13.5px; border-bottom: 2px solid #36682e; padding-bottom: 4px;">👥 Registered Group Delegates (${data.members.length} Members):</h4>
                                    <table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #e0e0e0; font-size: 11.5px; color: #333333;">
                                        <thead><tr style="background-color: #f0f7f1; color: #204e1f;"><th width="8%" align="center" style="padding: 4px;">#</th><th align="left" style="padding: 4px;">Full Name</th><th align="left" style="padding: 4px;">Email</th><th align="left" style="padding: 4px;">Mobile</th><th align="left" style="padding: 4px;">Designation</th></tr></thead>
                                        <tbody>${data.members.map((m, i) => `<tr><td align="center" style="font-weight: bold; padding: 4px;">${i + 1}</td><td style="font-weight: 600; padding: 4px;">${m.fullName}</td><td style="padding: 4px;">${m.email || "N/A"}</td><td style="padding: 4px;">${m.mobile || "N/A"}</td><td style="padding: 4px;">${m.designation || "N/A"}</td></tr>`).join("")}</tbody>
                                    </table>
                                </td></tr>
                            </table>` : ""}
                            ${FOOTER_BLOCK}
                        </td>
                    </tr>${EMAIL_WRAPPER_CLOSE}`;

  await sendArogyaEmail(
    fromEmail,
    `New ${data.isGroup ? "Group" : "Delegate"} Registration Lead: ${data.fullName} [ID: ${data.delegateId}]`,
    html,
    `A new ${data.isGroup ? "Group Registration" : "Delegate Registration"} lead has been recorded.\n\nRegistration ID: ${data.delegateId}\nFull Name: ${data.fullName}\nPass Selected: ${data.passName}\nConference Days: ${formattedDays}\nAmount Paid: ${displayPrice}\nPayment Mode: ${data.paymentMode}`
  );
}

/** Matches the exact payload shape backend-arogya/services/delegate/whatsappService.js sent —
 * the moksha-backend version previously sent a stripped-down payload missing `source`, `media`,
 * `buttons`, `carouselCards`, `location`, `attributes` and `paramsFallbackValue`. AiSensy's
 * approved WhatsApp OTP template is a "Copy Code" button template — omitting the `buttons` array
 * (which repeats the OTP as a URL-button parameter) is the most likely reason OTPs stopped
 * arriving even though the API call itself was returning 200 OK. */
export async function sendArogyaWhatsappOtp(phone: string, fullName: string, otp: string): Promise<void> {
  const { aisensy } = resolveOtpConfig("AROGYA");
  if (!aisensy) throw ApiError.internal("AiSensy is not configured for AROGYA");

  let destination = phone.replace(/\D/g, "");
  if (destination.length === 10) destination = `91${destination}`;
  const nameParam = fullName && fullName.trim() !== "" ? fullName.trim().split(" ")[0] : "user";

  const payload = {
    apiKey: aisensy.apiKey,
    campaignName: aisensy.campaignOtp,
    destination,
    userName: "Namo Gange Wellness Pvt. Ltd.",
    templateParams: [otp],
    source: "new-landing-page form",
    media: {},
    buttons: [
      { type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: otp }] },
    ],
    carouselCards: [],
    location: {},
    attributes: {},
    paramsFallbackValue: { FirstName: nameParam },
  };

  const response = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    logger.error("Arogya AiSensy OTP send failed", { status: response.status, body, destination });
    throw ApiError.internal("Failed to send OTP via WhatsApp");
  }
}
