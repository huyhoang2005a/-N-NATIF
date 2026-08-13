import type { EmailSender, SendEmailInput } from "@r2m/domain";
import { loadEnv } from "@r2m/env";
import nodemailer, { type Transporter } from "nodemailer";

/** Added 2026-08 — user has no domain to verify with Resend, so this is the primary
 * `EmailSender` (see `main.ts::buildEmailSender`) until one is available. Works with any
 * standard SMTP relay, including sending through an existing mailbox (e.g. Gmail with an
 * App Password — a normal account password is rejected by Gmail for SMTP AUTH). */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    const env = loadEnv();
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.EMAIL_FROM_ADDRESS) {
      throw new Error("SmtpEmailSender requires SMTP_HOST, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM_ADDRESS to be set.");
    }
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    this.from = env.EMAIL_FROM_NAME ? `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>` : env.EMAIL_FROM_ADDRESS;
  }

  async send(input: SendEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  }
}
