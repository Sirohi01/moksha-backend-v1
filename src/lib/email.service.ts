import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    logger.warn(`SMTP not configured — skipping email to ${to} (subject: ${subject})`);
    return;
  }

  await getTransporter().sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}
