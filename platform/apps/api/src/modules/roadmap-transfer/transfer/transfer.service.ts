import type {
  AddTransferManifestItemRequest,
  AddTransferRecipientRequest,
  CreateTransferManifestRequest,
  ShareTransferManifestRequest,
  TransferManifestDetailResponse,
  TransferManifestItemResponse,
  TransferManifestResponse,
  TransferRecipientResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { CaseMemberRole, ConflictError, ErrorCode, ForbiddenError, NotFoundError, TransferManifestStatus } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { ResourceAccessGrantsRepository } from "../../resource-catalog/resource-access-grants.repository";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { OutboxService } from "../../platform-operations/jobs/outbox.service";
import { TechnologyCaseRepository } from "../../technology-case/technology-case.repository";
import { TechnologyCaseService } from "../../technology-case/technology-case.service";
import { assertTransferManifestTransition } from "../domain/transfer.state-machine";
import { TransferManifestRepository } from "./transfer.repository";

function toManifestResponse(
  row: {
    id: string;
    technologyCaseId: string;
    versionNo: number;
    title: string;
    status: string;
    createdByUserId: string;
    generatedAt: Date | null;
    sharedAt: Date | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  },
  itemCount: number,
  recipientCount: number,
): TransferManifestResponse {
  return {
    id: row.id,
    technologyCaseId: row.technologyCaseId,
    versionNo: row.versionNo,
    title: row.title,
    status: row.status,
    createdByUserId: row.createdByUserId,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    sharedAt: row.sharedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    note: row.note,
    itemCount,
    recipientCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toItemResponse(row: {
  id: string;
  transferManifestId: string;
  resourceVersionId: string;
  locationUrlSnapshot: string;
  checksumSha256: string | null;
  permission: string;
  createdAt: Date;
}): TransferManifestItemResponse {
  return {
    id: row.id,
    transferManifestId: row.transferManifestId,
    resourceVersionId: row.resourceVersionId,
    locationUrlSnapshot: row.locationUrlSnapshot,
    checksumSha256: row.checksumSha256,
    permission: row.permission,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRecipientResponse(row: {
  id: string;
  transferManifestId: string;
  recipientOrganizationId: string | null;
  recipientUserId: string | null;
  permission: string;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
}): TransferRecipientResponse {
  return {
    id: row.id,
    transferManifestId: row.transferManifestId,
    recipientOrganizationId: row.recipientOrganizationId,
    recipientUserId: row.recipientUserId,
    permission: row.permission,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** UC-TRF-01. Bounded context: Roadmap & Transfer (phần Transfer, Phase 6). */
@Injectable()
export class TransferManifestService {
  constructor(
    private readonly repository: TransferManifestRepository,
    private readonly caseRepository: TechnologyCaseRepository,
    private readonly caseService: TechnologyCaseService,
    private readonly grantsRepository: ResourceAccessGrantsRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** UC-TRF-01 actor: "Case Owner" — nghiêm ngặt hơn roadmap's `WRITE_ROLES`
   * (OWNER+TECHNICAL_MEMBER), chỉ đúng 1 role, đúng pattern đã có sẵn ở
   * `technology-case.service.ts` (`addOrganization`). */
  private async assertOwner(technologyCaseId: string, actor: ActorContext): Promise<void> {
    const membership = await this.caseRepository.findActiveMembership(technologyCaseId, actor.userId);
    if (membership?.role !== CaseMemberRole.OWNER) {
      throw new ForbiddenError(ErrorCode.AUTH_FORBIDDEN, "Only the active case OWNER may manage transfer manifests.");
    }
  }

  private async findManifestOrThrow(id: string) {
    const manifest = await this.repository.findById(id);
    if (!manifest) {
      throw new NotFoundError(ErrorCode.TRANSFER_MANIFEST_NOT_FOUND, "Transfer manifest not found.");
    }
    return manifest;
  }

  async create(
    actor: ActorContext,
    technologyCaseId: string,
    input: CreateTransferManifestRequest,
    requestIdHeader: string | null,
  ): Promise<TransferManifestResponse> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertOwner(technologyCaseId, actor);

    const latest = await this.repository.findLatestVersionByCase(technologyCaseId);
    const nextVersionNo = (latest?.versionNo ?? 0) + 1;

    const manifest = await this.db.transaction(async (tx) => {
      const created = await this.repository.create(
        {
          technologyCaseId,
          versionNo: nextVersionNo,
          title: input.title,
          note: input.note,
          createdByUserId: actor.userId,
        },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "transfer_manifest.create",
          entityType: "transfer_manifest",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );

      await this.outboxService.append(
        "transfer_manifest",
        created.id,
        { type: "TransferManifestCreated", transferManifestId: created.id, technologyCaseId, createdByUserId: actor.userId },
        tx,
      );

      return created;
    });

    // Just-created manifest: 0 item, 0 recipient — no query needed.
    return toManifestResponse(manifest, 0, 0);
  }

  async listByCase(actor: ActorContext, technologyCaseId: string): Promise<TransferManifestResponse[]> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);

    const manifests = await this.repository.listByCase(technologyCaseId);
    return Promise.all(
      manifests.map(async (m) => {
        const [items, recipients] = await Promise.all([this.repository.listItems(m.id), this.repository.listRecipients(m.id)]);
        return toManifestResponse(m, items.length, recipients.length);
      }),
    );
  }

  async getById(actor: ActorContext, id: string): Promise<TransferManifestDetailResponse> {
    const manifest = await this.findManifestOrThrow(id);
    const technologyCase = await this.caseRepository.findById(manifest.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);

    const [items, recipients] = await Promise.all([this.repository.listItems(id), this.repository.listRecipients(id)]);
    return {
      ...toManifestResponse(manifest, items.length, recipients.length),
      items: items.map(toItemResponse),
      recipients: recipients.map(toRecipientResponse),
    };
  }

  /** `locationUrlSnapshot`/`checksumSha256` snapshot từ resource_version tại thời điểm
   * thêm — KHÔNG lưu file gốc, chỉ metadata/location (business invariant UC-TRF-01). */
  async addItem(
    actor: ActorContext,
    transferManifestId: string,
    input: AddTransferManifestItemRequest,
  ): Promise<TransferManifestItemResponse> {
    const manifest = await this.findManifestOrThrow(transferManifestId);
    await this.assertOwner(manifest.technologyCaseId, actor);

    const version = await this.repository.findResourceVersionById(input.resourceVersionId);
    if (!version) {
      throw new NotFoundError(ErrorCode.RESOURCE_VERSION_NOT_FOUND, "Resource version not found.");
    }
    const locationUrlSnapshot = version.sourceUrl ?? `s3://${version.storageObjectKey}`;

    const item = await this.db.transaction((tx) =>
      this.repository.addItem(
        {
          transferManifestId,
          resourceVersionId: input.resourceVersionId,
          locationUrlSnapshot,
          checksumSha256: version.contentHashSha256,
          permission: input.permission,
          metadataSnapshot: { versionNo: version.versionNo, versionLabel: version.versionLabel, publishedAt: version.publishedAt },
        },
        tx,
      ),
    );
    return toItemResponse(item);
  }

  async addRecipient(
    actor: ActorContext,
    transferManifestId: string,
    input: AddTransferRecipientRequest,
  ): Promise<TransferRecipientResponse> {
    const manifest = await this.findManifestOrThrow(transferManifestId);
    await this.assertOwner(manifest.technologyCaseId, actor);

    const recipient = await this.db.transaction((tx) =>
      this.repository.addRecipient(
        {
          transferManifestId,
          recipientOrganizationId: input.recipientOrganizationId,
          recipientUserId: input.recipientUserId,
          permission: input.permission,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
        tx,
      ),
    );
    return toRecipientResponse(recipient);
  }

  /** UC-TRF-01 business invariant: "Share bị chặn nếu thiếu item/recipient", "Grant có
   * đúng một recipient target và expiry/revoke status", "Mỗi access grant từ transfer
   * phải có expires_at". Tạo N (item × recipient) `resource_access_grant` trong CÙNG
   * transaction với việc chuyển manifest sang SHARED — không port
   * `validate_transfer_manifest_share()` (SQL trigger trong spec file) sang DB, enforce
   * ở đây thay (xem comment đầu `0010_phase6_transfer_constraints.sql`).
   *
   * Permission của grant lấy theo `recipient.permission` (không phải `item.permission`)
   * — quyết định tự đặt (spec không nói rõ 2 field này ai thắng khi khác nhau):
   * `item.permission` coi là mức mặc định/gợi ý lúc thêm vào gói, còn quyền THẬT SỰ một
   * người nhận được là quyền gán khi thêm họ làm recipient — khớp trực giác "tôi cấp cho
   * người này quyền X trên toàn bộ gói", không phải "từng file có quyền khác nhau cho
   * cùng 1 người". */
  async share(actor: ActorContext, id: string, input: ShareTransferManifestRequest, requestIdHeader: string | null): Promise<TransferManifestResponse> {
    const manifest = await this.findManifestOrThrow(id);
    await this.assertOwner(manifest.technologyCaseId, actor);
    assertTransferManifestTransition(manifest.status as TransferManifestStatus, TransferManifestStatus.SHARED);

    const technologyCase = await this.caseRepository.findById(manifest.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }

    const [items, recipients] = await Promise.all([this.repository.listItems(id), this.repository.listRecipients(id)]);
    if (items.length === 0) {
      throw new ConflictError(ErrorCode.TRANSFER_MANIFEST_NO_ITEMS, "Transfer manifest must have at least 1 item before sharing.");
    }
    if (recipients.length === 0) {
      throw new ConflictError(ErrorCode.TRANSFER_MANIFEST_NO_RECIPIENTS, "Transfer manifest must have at least 1 recipient before sharing.");
    }
    const shareExpiresAt = new Date(input.expiresAt);
    if (shareExpiresAt.getTime() <= Date.now()) {
      throw new ConflictError(ErrorCode.TRANSFER_MANIFEST_EXPIRATION_MUST_BE_FUTURE, "Expiration must be in the future.");
    }

    const itemResourceIds = await Promise.all(
      items.map(async (item) => {
        const version = await this.repository.findResourceVersionById(item.resourceVersionId);
        if (!version) {
          throw new Error(`resource_version ${item.resourceVersionId} referenced by transfer_manifest_item ${item.id} not found — data integrity violation.`);
        }
        return version.resourceId;
      }),
    );

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(
        id,
        manifest.version,
        { status: TransferManifestStatus.SHARED, sharedAt: new Date(), expiresAt: shareExpiresAt },
        tx,
      );
      if (!result) {
        throw new ConflictError(ErrorCode.TRANSFER_MANIFEST_INVALID_TRANSITION, "Transfer manifest was modified concurrently — retry.");
      }

      for (const recipient of recipients) {
        const grantExpiresAt = recipient.expiresAt ?? shareExpiresAt;
        for (const resourceId of itemResourceIds) {
          await this.grantsRepository.create(
            {
              resourceId,
              recipientOrganizationId: recipient.recipientOrganizationId,
              recipientUserId: recipient.recipientUserId,
              permission: recipient.permission,
              grantedByUserId: actor.userId,
              sourceTransferManifestId: id,
              expiresAt: grantExpiresAt,
            },
            tx,
          );
        }
      }

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "transfer_manifest.share",
          entityType: "transfer_manifest",
          entityId: id,
          beforeData: manifest,
          afterData: result,
        },
        tx,
      );

      await this.outboxService.append(
        "transfer_manifest",
        id,
        {
          type: "TransferManifestShared",
          transferManifestId: id,
          technologyCaseId: manifest.technologyCaseId,
          recipientUserIds: recipients.filter((r) => r.recipientUserId).map((r) => r.recipientUserId!),
          recipientOrganizationIds: recipients.filter((r) => r.recipientOrganizationId).map((r) => r.recipientOrganizationId!),
        },
        tx,
      );

      return result;
    });

    return toManifestResponse(updated, items.length, recipients.length);
  }

  async revoke(actor: ActorContext, id: string, requestIdHeader: string | null): Promise<TransferManifestResponse> {
    const manifest = await this.findManifestOrThrow(id);
    await this.assertOwner(manifest.technologyCaseId, actor);
    assertTransferManifestTransition(manifest.status as TransferManifestStatus, TransferManifestStatus.REVOKED);

    const technologyCase = await this.caseRepository.findById(manifest.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(id, manifest.version, { status: TransferManifestStatus.REVOKED, revokedAt: new Date() }, tx);
      if (!result) {
        throw new ConflictError(ErrorCode.TRANSFER_MANIFEST_INVALID_TRANSITION, "Transfer manifest was modified concurrently — retry.");
      }

      await this.grantsRepository.revokeAllBySourceManifest(id, actor.userId, tx);

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "transfer_manifest.revoke",
          entityType: "transfer_manifest",
          entityId: id,
          beforeData: manifest,
          afterData: result,
        },
        tx,
      );

      await this.outboxService.append(
        "transfer_manifest",
        id,
        { type: "TransferAccessRevoked", transferManifestId: id, technologyCaseId: manifest.technologyCaseId, revokedByUserId: actor.userId },
        tx,
      );

      return result;
    });

    const [items, recipients] = await Promise.all([this.repository.listItems(id), this.repository.listRecipients(id)]);
    return toManifestResponse(updated, items.length, recipients.length);
  }
}
