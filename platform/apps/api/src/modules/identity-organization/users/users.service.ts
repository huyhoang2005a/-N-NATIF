import { randomUUID } from "node:crypto";
import type {
  AvatarUploadResponse,
  PlatformUserDetailResponse,
  PlatformUserResponse,
  PlatformUserStatsResponse,
  RequestAvatarUploadRequest,
  UpdateProfileRequest,
  UserProfileResponse,
  UserPublicInfoResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertPlatformAdmin } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, NotFoundError, PlatformRole } from "@r2m/domain";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { FileSafetyService } from "../../../common/file-safety/file-safety.service";
import { S3Service } from "../../../common/storage/s3.service";
import { zeroFillWeeklySignups } from "../../../common/stats/week-buckets.util";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { OutboxService } from "../../platform-operations/jobs/outbox.service";
import { UsersRepository } from "./users.repository";

interface ProfileRow {
  userId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  jobTitle: string | null;
  locale: string | null;
  timezone: string | null;
  avatarUrl: string | null;
}

function toPlatformUserResponse(row: {
  id: string;
  primaryEmail: string;
  profile: { displayName: string } | null;
  platformRole: string;
  status: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}): PlatformUserResponse {
  return {
    userId: row.id,
    primaryEmail: row.primaryEmail,
    displayName: row.profile?.displayName ?? null,
    platformRole: row.platformRole,
    status: row.status,
    emailVerified: row.emailVerifiedAt !== null,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  };
}

/** UC-SYS-02 — profile fields only; email changes are out of scope here by design
 * (they require the separate identity-verification flow the spec mandates). */
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly s3Service: S3Service,
    private readonly fileSafetyService: FileSafetyService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** `user_profile.avatar_url` stores the S3 object key, not a durable URL (presigned
   * URLs expire) — resolved fresh on every read, same pattern as verification documents. */
  private async toResponse(profile: ProfileRow): Promise<UserProfileResponse> {
    const avatarUrl = profile.avatarUrl ? (await this.s3Service.createResourceDownloadUrl(profile.avatarUrl)).url : null;
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      jobTitle: profile.jobTitle,
      locale: profile.locale ?? "vi-VN",
      timezone: profile.timezone ?? "Asia/Bangkok",
      avatarUrl,
    };
  }

  async getMyProfile(actor: ActorContext): Promise<UserProfileResponse> {
    const profile = await this.usersRepository.getProfile(actor.userId);
    if (!profile) {
      throw new NotFoundException("Profile not found.");
    }
    return this.toResponse(profile);
  }

  async updateMyProfile(
    actor: ActorContext,
    update: UpdateProfileRequest,
    requestId: string | null,
  ): Promise<UserProfileResponse> {
    const before = await this.usersRepository.getProfile(actor.userId);
    const changedFields = Object.keys(update);

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.usersRepository.updateProfile(actor.userId, update, tx);
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId,
          action: "user_profile.update",
          entityType: "user_profile",
          entityId: actor.userId,
          beforeData: before,
          afterData: result,
        },
        tx,
      );
      await this.outboxService.append(
        "user_profile",
        actor.userId,
        { type: "UserProfileUpdated", userId: actor.userId, changedFields },
        tx,
      );
      return result;
    });

    return this.toResponse(updated);
  }

  /** Not spec-mandated — explicit user-approved addition. Presigned PUT, same shape as
   * `ResourcesService.requestUpload`; avatars live under `avatars/{userId}/` in the
   * resource bucket (no dedicated bucket needed for one small image per user). */
  async requestAvatarUpload(actor: ActorContext, input: RequestAvatarUploadRequest): Promise<AvatarUploadResponse> {
    const safeFilename = input.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageObjectKey = `avatars/${actor.userId}/${randomUUID()}_${safeFilename}`;
    const { url, expiresIn } = await this.s3Service.createResourceUploadUrl(storageObjectKey, input.mimeType);
    return { uploadUrl: url, storageObjectKey, expiresIn };
  }

  /** MIME-sniff + malware-scan the just-uploaded object before accepting it as the new
   * avatar — same guard `verification.service.ts`/`author-verification.service.ts` apply
   * to every other user-uploaded file, since an avatar is displayed to other users too. */
  async updateMyAvatar(actor: ActorContext, storageObjectKey: string, requestId: string | null): Promise<UserProfileResponse> {
    const buffer = await this.s3Service.getResourceObjectBuffer(storageObjectKey);
    if (!this.fileSafetyService.sniffMimeType(buffer)) {
      await this.s3Service.deleteResourceObject(storageObjectKey);
      throw new ConflictError(ErrorCode.AVATAR_REJECTED, "Uploaded image does not match any accepted file type (JPEG/PNG/WEBP).");
    }
    const scanResult = await this.fileSafetyService.scanForMalware(buffer);
    if (!scanResult.clean) {
      await this.s3Service.deleteResourceObject(storageObjectKey);
      throw new ConflictError(ErrorCode.AVATAR_REJECTED, "Uploaded image failed malware scan.", { signature: scanResult.signature });
    }

    const before = await this.usersRepository.getProfile(actor.userId);
    const previousKey = before?.avatarUrl ?? null;

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.usersRepository.updateProfile(actor.userId, { avatarUrl: storageObjectKey }, tx);
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId,
          action: "user_profile.update_avatar",
          entityType: "user_profile",
          entityId: actor.userId,
          beforeData: { avatarUrl: previousKey },
          afterData: { avatarUrl: storageObjectKey },
        },
        tx,
      );
      return result;
    });

    // Best-effort cleanup of the old object — not part of the transaction (S3 has no
    // rollback), and a failure here shouldn't fail the profile update itself.
    if (previousKey && previousKey !== storageObjectKey) {
      await this.s3Service.deleteResourceObject(previousKey).catch(() => undefined);
    }

    return this.toResponse(updated);
  }

  async removeMyAvatar(actor: ActorContext, requestId: string | null): Promise<UserProfileResponse> {
    const before = await this.usersRepository.getProfile(actor.userId);
    const previousKey = before?.avatarUrl ?? null;

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.usersRepository.updateProfile(actor.userId, { avatarUrl: null }, tx);
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId,
          action: "user_profile.remove_avatar",
          entityType: "user_profile",
          entityId: actor.userId,
          beforeData: { avatarUrl: previousKey },
          afterData: { avatarUrl: null },
        },
        tx,
      );
      return result;
    });

    if (previousKey) {
      await this.s3Service.deleteResourceObject(previousKey).catch(() => undefined);
    }

    return this.toResponse(updated);
  }

  async getPublicInfo(userIds: string[]): Promise<UserPublicInfoResponse[]> {
    const rows = await this.usersRepository.findDisplayNames(userIds);
    return rows.map((row) => ({ userId: row.userId, displayName: row.displayName }));
  }

  /** Not spec-mandated — explicit user-approved addition, see users.repository.ts.
   * `/platform/users` nav item (admin-only) has been a permanent "Sắp ra mắt" placeholder
   * until this existed. */
  async listAllForPlatform(actor: ActorContext, limit: number, offset: number): Promise<PlatformUserResponse[]> {
    assertPlatformAdmin(actor);
    const rows = await this.usersRepository.listAll(limit, offset);
    return rows.map(toPlatformUserResponse);
  }

  /** Not spec-mandated — explicit user-approved addition, the admin user-detail page
   * (2026-08-16) — `/platform/users` had no row drill-in. */
  async getByIdForPlatform(actor: ActorContext, userId: string): Promise<PlatformUserDetailResponse> {
    assertPlatformAdmin(actor);
    const row = await this.usersRepository.findByIdForPlatform(userId);
    if (!row) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, "User not found.");
    }
    const memberships = await this.usersRepository.listOrganizationMemberships(userId);
    return {
      ...toPlatformUserResponse(row),
      organizationMemberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
        status: m.status,
      })),
    };
  }

  /** Not spec-mandated — explicit user-approved addition (2026-08-16): `user_status` has
   * declared `SUSPENDED`/`DEACTIVATED` values and `auth.service.ts` already blocks login
   * for any non-ACTIVE status, but until now nothing ever set a user to `SUSPENDED` — the
   * enum value existed with no caller. `reason` is required (audit trail for a
   * restrictive action, same precedent as gap resolution notes). */
  async suspend(actor: ActorContext, userId: string, reason: string, requestId: string | null): Promise<PlatformUserResponse> {
    assertPlatformAdmin(actor);
    const user = await this.usersRepository.findByIdForPlatform(userId);
    if (!user) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, "User not found.");
    }
    if (user.status !== "ACTIVE") {
      throw new ConflictError(ErrorCode.USER_INVALID_TRANSITION, `Only an ACTIVE user can be suspended (current status: ${user.status}).`);
    }
    const updated = await this.usersRepository.updateStatus(userId, "SUSPENDED");
    if (!updated) throw new Error("suspend: update matched no row");
    await this.auditService.write({
      actorUserId: actor.userId,
      scopeOrganizationId: null,
      requestId,
      action: "user.suspend",
      entityType: "user_account",
      entityId: userId,
      beforeData: { status: user.status },
      afterData: { status: "SUSPENDED", reason },
    });
    return toPlatformUserResponse({ ...updated, profile: user.profile });
  }

  async reactivate(actor: ActorContext, userId: string, requestId: string | null): Promise<PlatformUserResponse> {
    assertPlatformAdmin(actor);
    const user = await this.usersRepository.findByIdForPlatform(userId);
    if (!user) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, "User not found.");
    }
    if (user.status !== "SUSPENDED") {
      throw new ConflictError(ErrorCode.USER_INVALID_TRANSITION, `Only a SUSPENDED user can be reactivated (current status: ${user.status}).`);
    }
    const updated = await this.usersRepository.updateStatus(userId, "ACTIVE");
    if (!updated) throw new Error("reactivate: update matched no row");
    await this.auditService.write({
      actorUserId: actor.userId,
      scopeOrganizationId: null,
      requestId,
      action: "user.reactivate",
      entityType: "user_account",
      entityId: userId,
      beforeData: { status: user.status },
      afterData: { status: "ACTIVE" },
    });
    return toPlatformUserResponse({ ...updated, profile: user.profile });
  }

  /** Not spec-mandated — explicit user-approved addition, powers the admin dashboard's
   * growth chart and role-breakdown chart. */
  async statsForPlatform(actor: ActorContext): Promise<PlatformUserStatsResponse> {
    assertPlatformAdmin(actor);
    const { weeklySignupRows, byRoleRows } = await this.usersRepository.statsForPlatform();

    const byRole = Object.fromEntries(Object.values(PlatformRole).map((role) => [role, 0]));
    for (const row of byRoleRows) {
      byRole[row.role] = row.count;
    }

    return { weeklySignups: zeroFillWeeklySignups(weeklySignupRows), byRole };
  }
}
