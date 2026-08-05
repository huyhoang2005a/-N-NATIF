import { randomUUID } from "node:crypto";
import type {
  CreateResourceVersionRequest,
  RegisterResourceRequest,
  RequestResourceUploadRequest,
  ResourceResponse,
  ResourceUploadResponse,
  ResourceVersionResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertActiveMember, assertCanManageResource, assertCanRegisterResource } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, ForbiddenError, NotFoundError, ResourceStatus, ResourceVersionStatus } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { S3Service } from "../../common/storage/s3.service";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { assertResourceTransition } from "./domain/resource.state-machine";
import { assertResourceVersionTransition } from "./domain/resource-version.state-machine";
import { ResourcesRepository } from "./resources.repository";

function toResourceResponse(resource: {
  id: string;
  ownerOrganizationId: string;
  createdByUserId: string;
  type: string;
  title: string;
  description: string | null;
  accessLevel: string;
  status: string;
  moderationStatus: string;
  externalIdentifier: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): ResourceResponse {
  return {
    id: resource.id,
    ownerOrganizationId: resource.ownerOrganizationId,
    createdByUserId: resource.createdByUserId,
    type: resource.type,
    title: resource.title,
    description: resource.description,
    accessLevel: resource.accessLevel,
    status: resource.status,
    moderationStatus: resource.moderationStatus,
    externalIdentifier: resource.externalIdentifier,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
    version: resource.version,
  };
}

function toVersionResponse(version: {
  id: string;
  resourceId: string;
  versionNo: number;
  versionLabel: string | null;
  sourceUrl: string | null;
  storageObjectKey: string | null;
  contentHashSha256: string | null;
  publishedAt: Date | null;
  status: string;
  createdByUserId: string;
  createdAt: Date;
}): ResourceVersionResponse {
  return {
    id: version.id,
    resourceId: version.resourceId,
    versionNo: version.versionNo,
    versionLabel: version.versionLabel,
    sourceUrl: version.sourceUrl,
    storageObjectKey: version.storageObjectKey,
    contentHashSha256: version.contentHashSha256,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    status: version.status,
    createdByUserId: version.createdByUserId,
    createdAt: version.createdAt.toISOString(),
  };
}

/** UC-RES-01 applied to Resource Catalog & Evidence. Bounded context: Resource Catalog. */
@Injectable()
export class ResourcesService {
  constructor(
    private readonly resourcesRepository: ResourcesRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly s3Service: S3Service,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async requestUpload(actor: ActorContext, input: RequestResourceUploadRequest): Promise<ResourceUploadResponse> {
    const safeFilename = input.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageObjectKey = `resources/${actor.userId}/${randomUUID()}_${safeFilename}`;
    const { url, expiresIn } = await this.s3Service.createResourceUploadUrl(storageObjectKey, input.mimeType);
    return { uploadUrl: url, storageObjectKey, expiresIn };
  }

  private async computeContentHash(storageObjectKey?: string): Promise<string | undefined> {
    if (!storageObjectKey) return undefined;
    try {
      return await this.s3Service.computeResourceContentSha256(storageObjectKey);
    } catch {
      throw new ConflictError(
        ErrorCode.RESOURCE_CONTENT_NOT_FOUND,
        "The uploaded file could not be found — request a new upload URL and try again.",
      );
    }
  }

  async register(
    actor: ActorContext,
    input: RegisterResourceRequest,
    requestIdHeader: string | null,
  ): Promise<ResourceResponse> {
    assertCanRegisterResource(actor);
    assertActiveMember(actor, input.ownerOrganizationId);

    const hasPaperFields = [input.doi, input.abstract, input.publisher, input.venue, input.publicationDate, input.language].some(
      (value) => value !== undefined,
    );
    if (hasPaperFields && input.type !== "PAPER") {
      throw new ConflictError(
        ErrorCode.RESOURCE_INVALID_TYPE_FOR_PAPER_METADATA,
        "Paper metadata fields are only valid when type is PAPER.",
      );
    }

    const contentHashSha256 = await this.computeContentHash(input.storageObjectKey);

    const resource = await this.db.transaction(async (tx) => {
      const createdResource = await this.resourcesRepository.create(
        {
          ownerOrganizationId: input.ownerOrganizationId,
          createdByUserId: actor.userId,
          type: input.type as never,
          title: input.title,
          description: input.description,
          accessLevel: input.accessLevel as never,
          externalIdentifier: input.externalIdentifier,
        },
        tx,
      );

      const version = await this.resourcesRepository.createVersion(
        {
          resourceId: createdResource.id,
          versionNo: 1,
          sourceUrl: input.sourceUrl,
          storageObjectKey: input.storageObjectKey,
          contentHashSha256,
          createdByUserId: actor.userId,
        },
        tx,
      );

      if (input.type === "PAPER") {
        await this.resourcesRepository.createPaperMetadata(
          {
            resourceId: createdResource.id,
            doi: input.doi,
            abstract: input.abstract,
            publisher: input.publisher,
            venue: input.venue,
            publicationDate: input.publicationDate,
            language: input.language,
          },
          tx,
        );
      }

      const ingestionJob = await this.resourcesRepository.createIngestionJob(version.id, tx);

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: input.ownerOrganizationId,
          requestId: requestIdHeader,
          action: "resource.register",
          entityType: "resource",
          entityId: createdResource.id,
          afterData: { resource: createdResource, version },
        },
        tx,
      );

      await this.outboxService.append(
        "resource",
        createdResource.id,
        {
          type: "ResourceRegistered",
          resourceId: createdResource.id,
          ownerOrganizationId: input.ownerOrganizationId,
          createdByUserId: actor.userId,
        },
        tx,
      );
      await this.outboxService.append(
        "resource",
        createdResource.id,
        { type: "ResourceIngestionQueued", resourceVersionId: version.id, ingestionJobId: ingestionJob.id },
        tx,
      );

      return createdResource;
    });

    return toResourceResponse(resource);
  }

  async getById(actor: ActorContext, id: string): Promise<ResourceResponse> {
    const resource = await this.resourcesRepository.findById(id);
    if (!resource) {
      throw new NotFoundError(ErrorCode.RESOURCE_NOT_FOUND, "Resource not found.");
    }
    await this.assertVisible(actor, resource);
    return toResourceResponse(resource);
  }

  async list(actor: ActorContext, q?: string): Promise<ResourceResponse[]> {
    const actorOrgIds = actor.memberships
      .filter((membership) => membership.status === "ACTIVE")
      .map((membership) => membership.organizationId);
    const rows = await this.resourcesRepository.listVisible({ q, actorUserId: actor.userId, actorOrgIds });
    return rows.map(toResourceResponse);
  }

  async createVersion(
    actor: ActorContext,
    resourceId: string,
    input: CreateResourceVersionRequest,
    requestIdHeader: string | null,
  ): Promise<ResourceVersionResponse> {
    const resource = await this.resourcesRepository.findById(resourceId);
    if (!resource) {
      throw new NotFoundError(ErrorCode.RESOURCE_NOT_FOUND, "Resource not found.");
    }
    assertCanManageResource(actor, resource.ownerOrganizationId);

    const contentHashSha256 = await this.computeContentHash(input.storageObjectKey);
    const latest = await this.resourcesRepository.findLatestVersionByResource(resourceId);
    const nextVersionNo = (latest?.versionNo ?? 0) + 1;

    const version = await this.db.transaction(async (tx) => {
      const created = await this.resourcesRepository.createVersion(
        {
          resourceId,
          versionNo: nextVersionNo,
          versionLabel: input.versionLabel,
          sourceUrl: input.sourceUrl,
          storageObjectKey: input.storageObjectKey,
          contentHashSha256,
          createdByUserId: actor.userId,
        },
        tx,
      );
      await this.resourcesRepository.createIngestionJob(created.id, tx);
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: resource.ownerOrganizationId,
          requestId: requestIdHeader,
          action: "resource.create_version",
          entityType: "resource_version",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toVersionResponse(version);
  }

  /** UC-RES-01 step 5: "Publish version sau validation; cập nhật resource ACTIVE nếu
   * policy cho phép" — decided policy (plan B.0.1): publishing the first version always
   * activates the resource; publishing any later version supersedes the previously
   * published one. */
  async publishVersion(
    actor: ActorContext,
    versionId: string,
    requestIdHeader: string | null,
  ): Promise<ResourceVersionResponse> {
    const version = await this.resourcesRepository.findVersionById(versionId);
    if (!version) {
      throw new NotFoundError(ErrorCode.RESOURCE_VERSION_NOT_FOUND, "Resource version not found.");
    }
    const resource = await this.resourcesRepository.findById(version.resourceId);
    if (!resource) {
      throw new NotFoundError(ErrorCode.RESOURCE_NOT_FOUND, "Resource not found.");
    }
    assertCanManageResource(actor, resource.ownerOrganizationId);
    assertResourceVersionTransition(
      version.status as ResourceVersionStatus,
      ResourceVersionStatus.PUBLISHED,
    );

    const currentlyPublished = await this.resourcesRepository.findPublishedVersionByResource(resource.id);
    if (currentlyPublished) {
      assertResourceVersionTransition(
        ResourceVersionStatus.PUBLISHED,
        ResourceVersionStatus.SUPERSEDED,
      );
    }

    const publishedVersion = await this.db.transaction(async (tx) => {
      if (currentlyPublished) {
        await this.resourcesRepository.updateVersionStatus(
          currentlyPublished.id,
          ResourceVersionStatus.SUPERSEDED,
          tx,
        );
      }
      const updated = await this.resourcesRepository.updateVersionStatus(
        versionId,
        ResourceVersionStatus.PUBLISHED,
        tx,
        { publishedAt: new Date() },
      );
      if (!updated) {
        throw new ConflictError(
          ErrorCode.RESOURCE_VERSION_IMMUTABLE,
          "This version could not be published — it may have changed concurrently.",
        );
      }

      if (resource.status === ResourceStatus.DRAFT) {
        assertResourceTransition(ResourceStatus.DRAFT, ResourceStatus.ACTIVE);
        const activated = await this.resourcesRepository.updateStatus(
          resource.id,
          resource.version,
          ResourceStatus.ACTIVE,
        );
        if (!activated) {
          throw new ConflictError(
            ErrorCode.RESOURCE_INVALID_TRANSITION,
            "Resource was modified concurrently — retry publishing.",
          );
        }
      }

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: resource.ownerOrganizationId,
          requestId: requestIdHeader,
          action: "resource_version.publish",
          entityType: "resource_version",
          entityId: versionId,
          beforeData: version,
          afterData: updated,
        },
        tx,
      );
      await this.outboxService.append(
        "resource",
        resource.id,
        {
          type: "ResourceVersionPublished",
          resourceId: resource.id,
          resourceVersionId: versionId,
          versionNo: version.versionNo,
        },
        tx,
      );

      return updated;
    });

    return toVersionResponse(publishedVersion);
  }

  /** Public so other bounded contexts (e.g. `technology-case/evidence.service.ts`, which
   * must confirm the actor can read a resource version before linking it as evidence —
   * UC-EVD-01) can reuse the exact same 3-way visibility check instead of duplicating
   * it. */
  async assertVisible(
    actor: ActorContext,
    resource: { id: string; accessLevel: string; ownerOrganizationId: string },
  ): Promise<void> {
    if (resource.accessLevel === "PUBLIC") return;
    const activeOrgIds = actor.memberships
      .filter((membership) => membership.status === "ACTIVE")
      .map((membership) => membership.organizationId);
    if (activeOrgIds.includes(resource.ownerOrganizationId)) return;
    const hasGrant = await this.resourcesRepository.hasActiveGrantForActor(
      resource.id,
      actor.userId,
      activeOrgIds,
    );
    if (!hasGrant) {
      throw new ForbiddenError(ErrorCode.RESOURCE_ACCESS_DENIED, "You do not have access to this resource.");
    }
  }
}
