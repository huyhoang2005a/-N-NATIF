import type {
  ConfirmEmailVerificationRequest,
  EmailVerificationStatusResponse,
} from "@r2m/contracts";
import { ConfirmEmailVerificationRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, HttpCode, Post, UsePipes } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { EmailVerificationService } from "./email-verification.service";

@Controller("email-verifications")
export class EmailVerificationController {
  constructor(private readonly emailVerificationService: EmailVerificationService) {}

  /** Public — the token itself identifies the user, no session required to click a link
   * from an email client. */
  @Public()
  @Post("confirm")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(ConfirmEmailVerificationRequestSchema))
  async confirm(@Body() body: ConfirmEmailVerificationRequest): Promise<EmailVerificationStatusResponse> {
    await this.emailVerificationService.confirm(body.token);
    return { emailVerified: true };
  }

  @Post("resend")
  @HttpCode(204)
  async resend(@CurrentActor() actor: ActorContext): Promise<void> {
    await this.emailVerificationService.resend(actor);
  }
}
