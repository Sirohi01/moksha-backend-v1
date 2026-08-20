import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let transporter: Transporter | null = null;
let fallbackTransporter: Transporter | null = null;

function transportOptions(port: number, secure: boolean) {
  return {
    host: env.SMTP_HOST,
    port,
    secure,
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  };
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport(transportOptions(env.SMTP_PORT, env.SMTP_SECURE));
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

  const message = {
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
  };

  try {
    await getTransporter().sendMail(message);
  } catch (error) {
    // Some cloud networks intermittently block or time out Gmail's STARTTLS port (587) while
    // implicit TLS on 465 remains reachable (and occasionally the reverse). Retry once through
    // the alternate official Gmail SMTP port before handing the failure to the notification queue.
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    const isConnectionFailure = ["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ENETUNREACH", "ECONNREFUSED"].includes(code);
    if (env.SMTP_HOST !== "smtp.gmail.com" || !isConnectionFailure) throw error;

    const fallbackPort = env.SMTP_PORT === 465 ? 587 : 465;
    if (!fallbackTransporter) {
      fallbackTransporter = nodemailer.createTransport(transportOptions(fallbackPort, fallbackPort === 465));
    }
    await fallbackTransporter.sendMail(message);
  }
}
