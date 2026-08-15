import { Module } from "@nestjs/common";
import { VerificationModule } from "../verification/verification.module";
import { PlatformAuditLogController } from "./audit/audit.controller";
import { AuditModule } from "./audit/audit.module";
import { JobsModule } from "./jobs/jobs.module";
import { PlatformOutboxController } from "./jobs/outbox.controller";
import { ContentFlagsController, PlatformContentFlagsController } from "./moderation/moderation.controller";
import { ModerationRepository } from "./moderation/moderation.repository";
import { ModerationService } from "./moderation/moderation.service";
import { NotificationsController } from "./notifications/notifications.controller";
import { NotificationsRepository } from "./notifications/notifications.repository";
import { NotificationsService } from "./notifications/notifications.service";

/** Phase 6 Sprint 6.3 — moderation (content_flag/moderation_decision) là sub-feature thật
 * đầu tiên của bounded context này, nên module chuyển từ "pure re-export aggregator"
 * (chỉ Audit+Jobs) sang có controller/provider riêng — vẫn giữ AuditModule/JobsModule
 * export cho các module khác đã dùng (IdentityOrganizationModule cùng lý do). Sprint 6.4
 * thêm notification vào cùng module này, không tạo module mới. `VerificationModule`
 * (2026-08-16) — `ModerationService` needs `AuthorVerificationRepository` to wire
 * RESTRICT_AUTHOR to a real `author_profile.SUSPENDED` transition. */
@Module({
  imports: [AuditModule, JobsModule, VerificationModule],
  controllers: [
    ContentFlagsController,
    PlatformContentFlagsController,
    NotificationsController,
    PlatformAuditLogController,
    PlatformOutboxController,
  ],
  providers: [ModerationRepository, ModerationService, NotificationsRepository, NotificationsService],
  exports: [AuditModule, JobsModule],
})
export class PlatformOperationsModule {}
