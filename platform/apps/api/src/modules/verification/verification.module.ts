import { Module } from "@nestjs/common";
import { AuditModule } from "../platform-operations/audit/audit.module";
import { JobsModule } from "../platform-operations/jobs/jobs.module";
import { OrganizationsModule } from "../identity-organization/organizations/organizations.module";
import { StorageModule } from "../../common/storage/storage.module";
import {
  OrganizationVerificationRequestController,
  PlatformOrganizationVerificationController,
  PlatformVerificationDocumentController,
} from "./verification.controller";
import { VerificationRepository } from "./verification.repository";
import { VerificationService } from "./verification.service";
import { AuthorVerificationController } from "./author-verification.controller";
import { PlatformAuthorVerificationController } from "./platform-author-verification.controller";
import { AuthorVerificationRepository } from "./author-verification.repository";
import { AuthorVerificationService } from "./author-verification.service";

@Module({
  imports: [AuditModule, JobsModule, OrganizationsModule, StorageModule],
  controllers: [
    PlatformOrganizationVerificationController,
    OrganizationVerificationRequestController,
    AuthorVerificationController,
    PlatformAuthorVerificationController,
    PlatformVerificationDocumentController,
  ],
  providers: [
    VerificationService,
    VerificationRepository,
    AuthorVerificationService,
    AuthorVerificationRepository,
  ],
  // AuthorVerificationRepository exported for ModerationService (2026-08-16) — RESTRICT_AUTHOR
  // transitions the flagged content's author to author_profile.SUSPENDED, reusing this
  // module's existing read/update methods rather than duplicating them.
  exports: [AuthorVerificationRepository],
})
export class VerificationModule {}
