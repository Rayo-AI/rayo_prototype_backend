import ENV from "../../db/env.ts";
import { logger } from "../lib/logger.ts";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export interface SignUpEmailBody {
  email: string;
  name: string;
}

interface BrevoEmailResponse {
  success: boolean;
  error?: string;
  messageId?: string;
}

const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "templates");

const appUrl = ENV.URL.FRONTEND;

async function loadTemplate(filename: string, vars: Record<string, string>): Promise<string> {
  const path = join(TEMPLATE_DIR, filename);
  let html = await readFile(path, "utf-8");

  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`\${${key}}`, value);
  }

  return html;
}

if (!ENV.BREVO.API_KEY) {
  logger.error("BREVO_API_KEY is not set");
  throw { success: false, error: "Email service not configured" };
}

if (!ENV.BREVO.EMAIL_FROM) {
  logger.error("EMAIL_FROM is not set");
  throw { success: false, error: "Email service not configured" };
}

export async function sendSignUpEmail(body: SignUpEmailBody): Promise<BrevoEmailResponse> {
  const { email, name } = body;

  try {
    const htmlContent = await loadTemplate("signup.html", { 
      name,
      appUrl: appUrl
    });

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": ENV.BREVO.API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Rayo AI", email: ENV.BREVO.EMAIL_FROM },
        to: [{ email, name }],
        subject: "Welcome to Rayo AI - Your Personal Finance Assistant",
        htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, message: text }, "Brevo error");
      return { success: false, error: text };
    }

    const data = (await res.json()) as { messageId?: string };
    logger.info({ messageId: data.messageId }, `Sign-up email sent to ${email}`);

    return { success: true, messageId: data.messageId };
  } catch (error: any) {
    logger.error({ error: error.message, cause: error.cause }, "Failed to send sign-up email");
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<BrevoEmailResponse> {
  try {
    const htmlContent = await loadTemplate("resetPassword.html", { 
      resetUrl: appUrl,
      token: resetToken
    });

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": ENV.BREVO.API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Rayo AI", email: ENV.BREVO.EMAIL_FROM },
        to: [{ email }],
        subject: "Reset your Rayo AI password",
        htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, message: text }, "Brevo error");
      return { success: false, error: text };
    }

    const data = (await res.json()) as { messageId?: string };
    logger.info({ messageId: data.messageId }, `Password reset email sent to ${email}`);

    return { success: true, messageId: data.messageId };
  } catch (error: any) {
    logger.error({ error: error.message, cause: error.cause }, "Failed to send password reset email");
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendOTPEmail(email: string, name: string, otp: string): Promise<BrevoEmailResponse> {
  try {
    const htmlContent = await loadTemplate("otp.html", { 
      name,
      otp,
      appUrl: appUrl
    });

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": ENV.BREVO.API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Rayo AI", email: ENV.BREVO.EMAIL_FROM },
        to: [{ email, name }],
        subject: "Your Rayo AI Email Verification Code",
        htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, message: text }, "Brevo error");
      return { success: false, error: text };
    }

    const data = (await res.json()) as { messageId?: string };
    logger.info({ messageId: data.messageId }, `OTP email sent to ${email}`);

    return { success: true, messageId: data.messageId };
  } catch (error: any) {
    logger.error({ error: error.message, cause: error.cause }, "Failed to send OTP email");
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendResendResetLinkEmail(email: string, resetToken: string): Promise<BrevoEmailResponse> {
  try {
    const htmlContent = await loadTemplate("resendResetPassword.html", { 
      resetUrl: appUrl,
      token: resetToken
    });

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": ENV.BREVO.API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Rayo AI", email: ENV.BREVO.EMAIL_FROM },
        to: [{ email }],
        subject: "Your Rayo AI Password Reset Link",
        htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, message: text }, "Brevo error");
      return { success: false, error: text };
    }

    const data = (await res.json()) as { messageId?: string };
    logger.info({ messageId: data.messageId }, `Resend password reset email sent to ${email}`);
    return { success: true, messageId: data.messageId };
  } catch (error: any) {
    logger.error({ error: error.message, cause: error.cause }, "Failed to send resend password reset email");
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendSuccessfulResetEmail(email: string): Promise<BrevoEmailResponse> {
  try {
    const htmlContent = await loadTemplate("successPasswordReset.html", {
      appUrl: appUrl
    });

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": ENV.BREVO.API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Rayo AI", email: ENV.BREVO.EMAIL_FROM },
        to: [{ email }],
        subject: "Your Rayo AI Password Has Been Reset",
        htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, message: text }, "Brevo error");
      return { success: false, error: text };
    }

    const data = (await res.json()) as { messageId?: string };
    logger.info({ messageId: data.messageId }, `Successful password reset email sent to ${email}`);
    return { success: true, messageId: data.messageId };
  } catch (error: any) {
    logger.error({ error: error.message, cause: error.cause }, "Failed to send successful password reset email");
    return { success: false, error: "Failed to send email" };
  }
}