import type { NotificationIdsRequest, NotificationResponse } from "@r2m/contracts";
import { ListNotificationsQuerySchema, NotificationIdsRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentActor() actor: ActorContext, @Query("status") status?: string): Promise<NotificationResponse[]> {
    const parsed = ListNotificationsQuerySchema.safeParse({ status });
    return this.service.list(actor, parsed.success ? parsed.data : {});
  }

  @Post("read")
  @UsePipes(new ZodValidationPipe(NotificationIdsRequestSchema))
  markRead(@CurrentActor() actor: ActorContext, @Body() body: NotificationIdsRequest): Promise<NotificationResponse[]> {
    return this.service.markRead(actor, body);
  }

  @Post("dismiss")
  @UsePipes(new ZodValidationPipe(NotificationIdsRequestSchema))
  markDismissed(@CurrentActor() actor: ActorContext, @Body() body: NotificationIdsRequest): Promise<NotificationResponse[]> {
    return this.service.markDismissed(actor, body);
  }
}
