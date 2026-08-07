export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/** Pure port — infra (Resend, console, …) implements this outside packages/domain. */
export interface EmailSender {
  send(input: SendEmailInput): Promise<void>;
}
