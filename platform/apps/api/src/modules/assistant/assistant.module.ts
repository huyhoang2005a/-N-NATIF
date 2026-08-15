import { Module } from "@nestjs/common";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { GeminiClient } from "./gemini.client";

/** New bounded context (10th) — not part of the locked spec, explicit user-approved
 * addition for the demo phase (same footing as `CommunityModule`). The chat feature (v1)
 * deliberately has no dependency on any other bounded-context module: pure Q&A against a
 * static system prompt, no account data read. `GeminiClient` is exported so other bounded
 * contexts (assessment-gap, roadmap-transfer) can import this module to get Gemini access
 * for their own draft-suggestion features — those features own their own case-data
 * authorization/context-loading, this module only owns the LLM transport. */
@Module({
  controllers: [AssistantController],
  providers: [AssistantService, GeminiClient],
  exports: [GeminiClient],
})
export class AssistantModule {}
