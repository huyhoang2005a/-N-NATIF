import type { EmailSender, SendEmailInput } from "@r2m/domain";
import { loadEnv } from "@r2m/env";
import { Resend } from "resend";

export class ResendEmailSender implements EmailSender {
  private readonly client: Resend;
  private readonly from: string;

  constructor() {
    const env = loadEnv();
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM_ADDRESS || !env.EMAIL_FROM_NAME) {
      throw new Error(
        "ResendEmailSender requires RESEND_API_KEY, EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME to be set.",
      );
    }
    this.client = new Resend(env.RESEND_API_KEY);
    this.from = `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`;
  }

  async send(input: SendEmailInput): Promise<void> {
    const result = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (result.error) {
      throw new Error(`ResendEmailSender: ${result.error.message}`);
    }
  }
}
