/**
 * Wraps a notification template's inner HTML in a full, branded email document before it ever
 * reaches sendEmail(). Table-based layout with every rule inline (no <style> block) on purpose —
 * Gmail strips <head>, and Outlook's Word rendering engine ignores most modern CSS (flexbox,
 * grid, margin/padding shorthand on non-table elements), so inline styles on <table>/<td> are the
 * one layout approach that reads the same across both. Every template's `body` field stays a
 * plain HTML fragment (as today); only this shell changes.
 */

const BRAND = {
  accent: "#8b6a3e",
  text: "#211611",
  textMuted: "#6b645c",
  surface: "#f6f5f3",
  card: "#ffffff",
  border: "#e7e4de",
  footerBg: "#f0efeb",
  font: "Georgia, 'Times New Roman', Times, serif",
};

export function renderEmailShell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Moksha Sewa</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};font-family:${BRAND.font};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.surface};width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background-color:${BRAND.card};border:1px solid ${BRAND.border};">
          <tr>
            <td bgcolor="${BRAND.accent}" style="background-color:${BRAND.accent};padding:20px 28px;">
              <span style="color:#ffffff;font-size:18px;line-height:24px;font-weight:bold;font-family:${BRAND.font};">
                Moksha Sewa
              </span>
              <div style="color:#f3ead9;font-size:11px;line-height:16px;font-family:${BRAND.font};margin-top:2px;">
                Free Cremation Assistance
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:${BRAND.text};font-size:14px;line-height:22px;font-family:${BRAND.font};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td bgcolor="${BRAND.footerBg}" style="background-color:${BRAND.footerBg};border-top:1px solid ${BRAND.border};padding:16px 28px;color:${BRAND.textMuted};font-size:11px;line-height:17px;font-family:${BRAND.font};">
              This is an automated message from Moksha Sewa — please do not reply directly to this email.
              <br />
              &copy; ${new Date().getFullYear()} Moksha Sewa. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
