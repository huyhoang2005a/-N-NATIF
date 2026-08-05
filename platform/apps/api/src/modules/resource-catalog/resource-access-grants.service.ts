import type { CreateResourceAccessRequest, ResourceAccessGrantResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertCanManageResource } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { ResourceAccessGrantsRepository } from "./resource-access-grants.repository";
import { ResourcesRepository } from "./resources.repository";

function toResponse(grant: {
  id: string;
  resourceId: string;
  recipientOrganizationId: string | null;
  recipientUserId: string | null;
  permission: string;
  status: string;
  grantedByUserId: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  createdAt: Date;
}): ResourceAccessGrantResponse {
  return {
    id: grant.id,
    resourceId: grant.resourceId,
    recipientOrganizationId: grant.recipientOrganizationId,
    recipientUserId: grant.recipientUserId,
    permission: grant.permission,
    status: grant.status,
    grantedByUserId: grant.grantedByUserId,
    expiresAt: grant.expiresAt?.toISOString() ?? null,
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    revokedByUserId: grant.revokedByUserId,
    createdAt: grant.createdAt.toISOString(),
  };
}

/** SUC-04 (đã chốt sau review, 2026-08-05). Bounded context: Resource Catalog. */
@Injectable()
export class ResourceAccessGrantsService {
  constructor(
    private readonly accessGrantsRepository: ResourceAccessGrantsRepository,
    private readonly resourcesRepository: ResourcesRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  private async assertManage(resourceId: string, actor: ActorContext) {
    const resource = await this.resourcesRepository.findById(resourceId);
    if (!resource) {
      throw new NotFoundError(ErrorCode.RESOURCE_NOT_FOUND, "Resource not found.");
    }
    assertCanManageResource(actor, resource.ownerOrganizationId);
    return resource;
  }

  async create(
    actor: ActorContext,
    resourceId: string,
    input: CreateResourceAccessRequest,
    requestIdHeader: string | null,
  ): Promise<ResourceAccessGrantResponse> {
    const resource = await this.assertManage(resourceId, actor);

    const duplicate = await this.accessGrantsRepository.findActiveDuplicate({
      resourceId,
      recipientUserId: input.recipientUserId,
      recipientOrganizationId: input.recipientOrganizationId,
      permission: input.permission,
    });
    if (duplicate) {
      throw new ConflictError(
        ErrorCode.ACCESS_GRANT_DUPLICATE,
        "An active grant with this recipient and permission already exists.",
      );
    }

    const grant = await this.db.transaction(async (tx) => {
      const created = await this.accessGrantsRepository.create(
        {
          resourceId,
          recipientUserId: input.recipientUserId,
          recipientOrganizationId: input.recipientOrganizationId,
          permission: input.permission as never,
          grantedByUserId: actor.userId,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: resource.ownerOrganizationId,
          requestId: requestIdHeader,
          action: "resource_access_grant.create",
          entityType: "resource_access_grant",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      await this.outboxService.append(
        "resource",
        resourceId,
        { type: "ResourceAccessGranted", accessGrantId: created.id, resourceId, grantedByUserId: actor.userId },
        tx,
      );

      return created;
    });

    return toResponse(grant);
  }

  async listByResource(actor: ActorContext, resourceId: string): Promise<ResourceAccessGrantResponse[]> {
    await this.assertManage(resourceId, actor);
    const rows = await this.accessGrantsRepository.listByResource(resourceId);
    return rows.map(toResponse);
  }

  async revoke(
    actor: ActorContext,
    grantId: string,
    requestIdHeader: string | null,
  ): Promise<ResourceAccessGrantResponse> {
    const existing = await this.accessGrantsRepository.findById(grantId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.ACCESS_GRANT_NOT_FOUND, "Access grant not found.");
    }
    const resource = await this.assertManage(existing.resourceId, actor);
    if (existing.status !== "ACTIVE") {
      throw new ConflictError(ErrorCode.ACCESS_GRANT_ALREADY_REVOKED, "This grant is no longer active.");
    }

    const revoked = await this.db.transaction(async (tx) => {
      const updated = await this.accessGrantsRepository.revoke(grantId, actor.userId, tx);
      if (!updated) {
        throw new ConflictError(ErrorCode.ACCESS_GRANT_ALREADY_REVOKED, "This grant is no longer active.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: resource.ownerOrganizationId,
          requestId: requestIdHeader,
          action: "resource_access_grant.revoke",
          entityType: "resource_access_grant",
          entityId: grantId,
          beforeData: existing,
          afterData: updated,
        },
        tx,
      );
      await this.outboxService.append(
        "resource",
        existing.resourceId,
        {
          type: "ResourceAccessRevoked",
          accessGrantId: grantId,
          resourceId: existing.resourceId,
          revokedByUserId: actor.userId,
        },
        tx,
      );
      return updated;
    });

    return toResponse(revoked);
  }
}
