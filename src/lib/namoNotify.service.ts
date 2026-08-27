import nodemailer from "nodemailer";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";
import { resolveOtpConfig, resolveSmtpConfig } from "./integrationConfig.service";
async function getTransporter() {
  const smtp = resolveSmtpConfig("NAMOGANGE");
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  return { transporter, smtp };
}

export async function sendNamoEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
  const { transporter, smtp } = await getTransporter();
  await transporter.sendMail({ from: `"${smtp.fromName}" <${smtp.fromEmail}>`, to, subject, html, text });
}

export async function sendNamoOtpEmail(email: string, otp: string): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #DF562C; text-align: center;">Namo Gange Trust</h2>
      <p>Dear User,</p>
      <p>Your OTP for verification is:</p>
      <div style="text-align: center; margin: 20px 0;">
        <h1 style="background: #fff9f4; color: #f1a06a; display: inline-block; padding: 10px 40px; border: 2px dashed #fca5a5; border-radius: 5px; letter-spacing: 5px;">${otp}</h1>
      </div>
      <p>This OTP is valid for <strong>5 minutes</strong>. Please do not share this OTP with anyone.</p>
      <p>Best regards,<br/>Team Namo Gange Trust</p>
    </div>`;
  await sendNamoEmail(email, "OTP Verification - Namo Gange Trust", html, `Your Namo Gange Trust OTP is ${otp}. Valid for 5 minutes.`);
}
export async function sendNamoWhatsappOtp(mobile: string, otp: string): Promise<void> {
  const config = resolveOtpConfig("NAMOGANGE");

  if (config.aisensy) {
    let destination = mobile.replace(/\D/g, "");
    if (destination.length === 10) destination = `91${destination}`;
    const response = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: config.aisensy.apiKey,
        campaignName: config.aisensy.campaignOtp,
        destination,
        userName: "Namo Gange Trust",
        templateParams: [otp],
      }),
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean; status?: string } | null;
    if (!response.ok || body?.success === false || body?.status === "error") {
      logger.error("Namo Gange AiSensy OTP send failed", { status: response.status, body, destination });
      throw ApiError.internal("Failed to send OTP via WhatsApp");
    }
    return;
  }

  if (config.opus) {
    const msg = `Your Namo Gange Trust verification OTP is ${otp}. Valid for 5 minutes.`;
    const url = `http://api.opustechnology.in/wapp/v2/api/send?apikey=${encodeURIComponent(config.opus.apiKey)}&mobile=${encodeURIComponent(mobile)}&msg=${encodeURIComponent(msg)}`;
    const response = await fetch(url);
    if (!response.ok) {
      logger.error("Namo Gange Opus OTP send failed", { status: response.status });
      throw ApiError.internal("Failed to send OTP via WhatsApp");
    }
    return;
  }

  throw ApiError.internal("WhatsApp OTP delivery is not configured for NAMOGANGE");
}
