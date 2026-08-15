import type { AssistantChatRequest, AssistantChatResponse } from "@r2m/contracts";
import { AssistantChatRequestSchema } from "@r2m/contracts";
import { Body, Controller, Post, UseGuards, UsePipes } from "@nestjs/common";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AssistantService } from "./assistant.service";

/** Not spec-mandated — explicit user-approved addition (2026-08, demo phase). Requires
 * auth (not `@Public()`) purely to bound abuse of a real, cost-metered API key — v1 has
 * no account-specific behavior otherwise, see `assistant.service.ts`. */
@Controller("assistant")
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post("chat")
  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: "assistant-chat", points: 20, durationSeconds: 60 })
  @UsePipes(new ZodValidationPipe(AssistantChatRequestSchema))
  chat(@Body() body: AssistantChatRequest): Promise<AssistantChatResponse> {
    return this.assistantService.chat(body);
  }
}
