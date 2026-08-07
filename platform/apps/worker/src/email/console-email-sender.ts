import type { EmailSender, SendEmailInput } from "@r2m/domain";

/** Dev fallback used while RESEND_API_KEY is unset (see main.ts). Never logs the email
 * body — it may contain a raw verification token — only who/what was "sent". */
export class ConsoleEmailSender implements EmailSender {
  async send(input: SendEmailInput): Promise<void> {
    console.log(`[worker] (console email) to=${input.to} subject="${input.subject}"`);
  }
}
