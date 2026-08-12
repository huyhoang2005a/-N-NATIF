import type {
  AnnotationResponse,
  CreateAnnotationRequest,
  ReviseAnnotationRequest,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertCanManageResource } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { AnnotationsRepository } from "./annotations.repository";
import { ResourcesRepository } from "./resources.repository";
import { ResourcesService } from "./resources.service";

interface AnnotationRow {
  id: string;
  resourceVersionId: string;
  createdByUserId: string;
  status: string;
  latestRevisionNo: number;
  createdAt: Date;
  updatedAt: Date;
}

interface RevisionRow {
  content: string;
  targetSnippet: string;
  pageNumber: number | null;
  sectionLabel: string | null;
  offsetStart: number | null;
  offsetEnd: number | null;
}

function toResponse(annotation: AnnotationRow, revision: RevisionRow): AnnotationResponse {
  return {
    id: annotation.id,
    resourceVersionId: annotation.resourceVersionId,
    createdByUserId: annotation.createdByUserId,
    status: annotation.status,
    latestRevisionNo: annotation.latestRevisionNo,
    content: revision.content,
    targetSnippet: revision.targetSnippet,
    pageNumber: revision.pageNumber,
    sectionLabel: revision.sectionLabel,
    offsetStart: revision.offsetStart,
    offsetEnd: revision.offsetEnd,
    createdAt: annotation.createdAt.toISOString(),
    updatedAt: annotation.updatedAt.toISOString(),
  };
}

/** UC-RES-02 applied to Resource Catalog & Evidence. Bounded context: Resource Catalog. */
@Injectable()
export class AnnotationsService {
  constructor(
    private readonly annotationsRepository: AnnotationsRepository,
    private readonly resourcesRepository: ResourcesRepository,
    private readonly resourcesService: ResourcesService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  private async assertManageAndGetVersionOwner(resourceVersionId: string, actor: ActorContext) {
    const version = await this.resourcesRepository.findVersionById(resourceVersionId);
    if (!version) {
      throw new NotFoundError(ErrorCode.RESOURCE_VERSION_NOT_FOUND, "Resource version not found.");
    }
    if (version.status === "WITHDRAWN") {
      throw new ConflictError(
        ErrorCode.RESOURCE_VERSION_IMMUTABLE,
        "Cannot annotate a withdrawn resource version.",
      );
    }
    const resource = await this.resourcesRepository.findById(version.resourceId);
    if (!resource) {
      throw new NotFoundError(ErrorCode.RESOURCE_NOT_FOUND, "Resource not found.");
    }
    assertCanManageResource(actor, resource.ownerOrganizationId);
    return { version, resource };
  }

  /** Not spec-mandated — explicit user-approved addition, see annotations.repository.ts.
   * Read access follows resource *visibility* (`assertVisible`), not `assertCanManageResource`
   * — any actor who can see the resource can read its annotations, matching how the create
   * form itself is presented in the UI to any resource viewer, not just managers. */
  async listByVersion(actor: ActorContext, resourceVersionId: string): Promise<AnnotationResponse[]> {
    const version = await this.resourcesRepository.findVersionById(resourceVersionId);
    if (!version) {
      throw new NotFoundError(ErrorCode.RESOURCE_VERSION_NOT_FOUND, "Resource version not found.");
    }
    const resource = await this.resourcesRepository.findById(version.resourceId);
    if (!resource) {
      throw new NotFoundError(ErrorCode.RESOURCE_NOT_FOUND, "Resource not found.");
    }
    await this.resourcesService.assertVisible(actor, resource);

    const annotations = await this.annotationsRepository.listByVersion(resourceVersionId);
    const revisions = await Promise.all(
      annotations.map((annotation) => this.annotationsRepository.findRevision(annotation.id, annotation.latestRevisionNo)),
    );
    return annotations.map((annotation, index) => {
      const revision = revisions[index];
      if (!revision) throw new Error(`listByVersion: annotation ${annotation.id} has no latest revision row`);
      return toResponse(annotation, revision);
    });
  }

  async create(
    actor: ActorContext,
    resourceVersionId: string,
    input: CreateAnnotationRequest,
    requestIdHeader: string | null,
  ): Promise<AnnotationResponse> {
    const { resource } = await this.assertManageAndGetVersionOwner(resourceVersionId, actor);

    const { annotation, revision } = await this.db.transaction(async (tx) => {
      const createdAnnotation = await this.annotationsRepository.create(
        { resourceVersionId, createdByUserId: actor.userId, latestRevisionNo: 1 },
        tx,
      );
      const createdRevision = await this.annotationsRepository.createRevision(
        {
          annotationId: createdAnnotation.id,
          revisionNo: 1,
          content: input.content,
          targetSnippet: input.targetSnippet,
          pageNumber: input.pageNumber,
          sectionLabel: input.sectionLabel,
          offsetStart: input.offsetStart,
          offsetEnd: input.offsetEnd,
          createdByUserId: actor.userId,
        },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: resource.ownerOrganizationId,
          requestId: requestIdHeader,
          action: "annotation.create",
          entityType: "annotation",
          entityId: createdAnnotation.id,
          afterData: { annotation: createdAnnotation, revision: createdRevision },
        },
        tx,
      );
      await this.outboxService.append(
        "annotation",
        createdAnnotation.id,
        {
          type: "AnnotationCreated",
          annotationId: createdAnnotation.id,
          resourceVersionId,
          createdByUserId: actor.userId,
        },
        tx,
      );

      return { annotation: createdAnnotation, revision: createdRevision };
    });

    return toResponse(annotation, revision);
  }

  async revise(
    actor: ActorContext,
    annotationId: string,
    input: ReviseAnnotationRequest,
    requestIdHeader: string | null,
  ): Promise<AnnotationResponse> {
    const annotation = await this.annotationsRepository.findById(annotationId);
    if (!annotation) {
      throw new NotFoundError(ErrorCode.ANNOTATION_NOT_FOUND, "Annotation not found.");
    }
    const { resource } = await this.assertManageAndGetVersionOwner(annotation.resourceVersionId, actor);

    const newRevisionNo = annotation.latestRevisionNo + 1;
    const { updatedAnnotation, revision } = await this.db.transaction(async (tx) => {
      const createdRevision = await this.annotationsRepository.createRevision(
        {
          annotationId,
          revisionNo: newRevisionNo,
          content: input.content,
          targetSnippet: input.targetSnippet,
          pageNumber: input.pageNumber,
          sectionLabel: input.sectionLabel,
          offsetStart: input.offsetStart,
          offsetEnd: input.offsetEnd,
          createdByUserId: actor.userId,
        },
        tx,
      );
      const bumped = await this.annotationsRepository.bumpLatestRevision(annotationId, newRevisionNo, tx);

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: resource.ownerOrganizationId,
          requestId: requestIdHeader,
          action: "annotation.revise",
          entityType: "annotation",
          entityId: annotationId,
          beforeData: { latestRevisionNo: annotation.latestRevisionNo },
          afterData: createdRevision,
        },
        tx,
      );
      await this.outboxService.append(
        "annotation",
        annotationId,
        {
          type: "AnnotationRevised",
          annotationId,
          previousRevisionNo: annotation.latestRevisionNo,
          newRevisionNo,
        },
        tx,
      );

      return { updatedAnnotation: bumped, revision: createdRevision };
    });

    return toResponse(updatedAnnotation, revision);
  }

  async remove(actor: ActorContext, annotationId: string, requestIdHeader: string | null): Promise<void> {
    const annotation = await this.annotationsRepository.findById(annotationId);
    if (!annotation) {
      throw new NotFoundError(ErrorCode.ANNOTATION_NOT_FOUND, "Annotation not found.");
    }
    const { resource } = await this.assertManageAndGetVersionOwner(annotation.resourceVersionId, actor);

    await this.db.transaction(async (tx) => {
      await this.annotationsRepository.remove(annotationId, tx);
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: resource.ownerOrganizationId,
          requestId: requestIdHeader,
          action: "annotation.remove",
          entityType: "annotation",
          entityId: annotationId,
        },
        tx,
      );
      await this.outboxService.append(
        "annotation",
        annotationId,
        { type: "AnnotationRemoved", annotationId, removedByUserId: actor.userId },
        tx,
      );
    });
  }
}
