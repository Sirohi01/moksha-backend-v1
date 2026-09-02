export const EMAIL_FONT = "Georgia, 'Times New Roman', Times, serif";

const P = `margin:0 0 14px 0;font-size:14px;line-height:22px;color:#211611;font-family:${EMAIL_FONT};`;
const P_LAST = `margin:0;font-size:14px;line-height:22px;color:#211611;font-family:${EMAIL_FONT};`;
const MUTED = `margin:0 0 14px 0;font-size:12px;line-height:18px;color:#6b645c;font-family:${EMAIL_FONT};`;

export function p(text: string): string {
  return `<p style="${P}">${text}</p>`;
}

export function pLast(text: string): string {
  return `<p style="${P_LAST}">${text}</p>`;
}

export function muted(text: string): string {
  return `<p style="${MUTED}">${text}</p>`;
}
export function callout(innerHtml: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px 0;">` +
    `<tr><td bgcolor="#f3ead9" style="background-color:#f3ead9;border:1px solid #e7d9c0;padding:12px 16px;` +
    `font-size:15px;font-weight:semibold;color:#8b6a3e;font-family:${EMAIL_FONT};">${innerHtml}</td></tr></table>`
  );
}
export function warningCallout(innerHtml: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px 0;">` +
    `<tr><td bgcolor="#fbeaea" style="background-color:#fbeaea;border:1px solid #eeccc9;padding:12px 16px;` +
    `font-size:15px;font-weight:semibold;color:#a33a34;font-family:${EMAIL_FONT};">${innerHtml}</td></tr></table>`
  );
}
export function detailRow(label: string, value: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px 0;">` +
    `<tr>` +
    `<td width="120" style="padding:6px 10px;font-size:12px;color:#6b645c;font-family:${EMAIL_FONT};vertical-align:top;">${label}</td>` +
    `<td style="padding:6px 10px;font-size:13px;color:#211611;font-family:${EMAIL_FONT};font-weight:semibold;vertical-align:top;">${value}</td>` +
    `</tr></table>`
  );
}

export function detailsBox(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px 0;background-color:#f6f5f3;border:1px solid #e7e4de;"><tr><td style="padding:6px;">${rows}</td></tr></table>`;
}

export function button(url: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 8px 4px 0;display:inline-block;">` +
    `<tr><td bgcolor="#8b6a3e" style="background-color:#8b6a3e;">` +
    `<a href="${url}" style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:semibold;` +
    `color:#ffffff;text-decoration:none;font-family:${EMAIL_FONT};">${label}</a>` +
    `</td></tr></table>`
  );
}
export function secondaryButton(url: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 4px 0;display:inline-block;">` +
    `<tr><td style="border:1px solid #8b6a3e;">` +
    `<a href="${url}" style="display:inline-block;padding:11px 25px;font-size:14px;font-weight:semibold;` +
    `color:#8b6a3e;text-decoration:none;font-family:${EMAIL_FONT};">${label}</a>` +
    `</td></tr></table>`
  );
}
