import type { UpdateProfileRequest, UserProfileResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import type { Database } from "@r2m/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { AuditService } from "../audit/audit.service";
import { OutboxService } from "../jobs/outbox.service";
import { UsersRepository } from "./users.repository";

function toResponse(profile: {
  userId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  jobTitle: string | null;
  locale: string | null;
  timezone: string | null;
}): UserProfileResponse {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    jobTitle: profile.jobTitle,
    locale: profile.locale ?? "vi-VN",
    timezone: profile.timezone ?? "Asia/Bangkok",
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
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async getMyProfile(actor: ActorContext): Promise<UserProfileResponse> {
    const profile = await this.usersRepository.getProfile(actor.userId);
    if (!profile) {
      throw new NotFoundException("Profile not found.");
    }
    return toResponse(profile);
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

    return toResponse(updated);
  }
}
