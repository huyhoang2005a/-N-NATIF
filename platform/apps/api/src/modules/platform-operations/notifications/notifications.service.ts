import type { ListNotificationsQuery, NotificationIdsRequest, NotificationResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Injectable } from "@nestjs/common";
import { NotificationsRepository } from "./notifications.repository";

function toResponse(row: {
  id: string;
  scopeOrganizationId: string | null;
  type: string;
  title: string;
  message: string;
  status: string;
  readAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}): NotificationResponse {
  return {
    id: row.id,
    scopeOrganizationId: row.scopeOrganizationId,
    type: row.type,
    title: row.title,
    message: row.message,
    status: row.status,
    readAt: row.readAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** UC-SYS-01. Bounded context: Platform Operations (phần notification, Phase 6 Sprint 6.4). */
@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async list(actor: ActorContext, query: ListNotificationsQuery): Promise<NotificationResponse[]> {
    const rows = await this.repository.listForActor(actor.userId, query.status);
    return rows.map(toResponse);
  }

  async markRead(actor: ActorContext, input: NotificationIdsRequest): Promise<NotificationResponse[]> {
    const rows = await this.repository.markRead(actor.userId, input.ids);
    return rows.map(toResponse);
  }

  async markDismissed(actor: ActorContext, input: NotificationIdsRequest): Promise<NotificationResponse[]> {
    const rows = await this.repository.markDismissed(actor.userId, input.ids);
    return rows.map(toResponse);
  }
}
