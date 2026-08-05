import type { AnnotationResponse, ReviseAnnotationRequest } from "@r2m/contracts";
import { ReviseAnnotationRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Delete, HttpCode, Param, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AnnotationsService } from "./annotations.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("annotations")
export class AnnotationsController {
  constructor(private readonly annotationsService: AnnotationsService) {}

  @Post(":id/revisions")
  @UsePipes(new ZodValidationPipe(ReviseAnnotationRequestSchema))
  revise(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: ReviseAnnotationRequest,
    @Req() req: Request,
  ): Promise<AnnotationResponse> {
    return this.annotationsService.revise(actor, id, body, requestId(req));
  }

  /** §13.2: soft-delete — sets `AnnotationStatus.REMOVED`, does not delete the row (see
   * plan B.0.1). */
  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<void> {
    return this.annotationsService.remove(actor, id, requestId(req));
  }
}
