import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { CommunityModule } from "../community/community.module";
import { AuditModule } from "../platform-operations/audit/audit.module";
import { JobsModule } from "../platform-operations/jobs/jobs.module";
import {
  ResourceAccessGrantsController,
  ResourceVersionsController,
  ResourcesController,
} from "./resources.controller";
import { AnnotationsController } from "./annotations.controller";
import { ResourcesRepository } from "./resources.repository";
import { ResourcesService } from "./resources.service";
import { AnnotationsRepository } from "./annotations.repository";
import { AnnotationsService } from "./annotations.service";
import { ResourceAccessGrantsRepository } from "./resource-access-grants.repository";
import { ResourceAccessGrantsService } from "./resource-access-grants.service";

/** Resource Catalog & Evidence bounded context — one NestJS module with 3 controllers
 * (mirrors the `verification/` pattern: several controllers, one module, no aggregator
 * needed since there is only one real module here — see CLAUDE.md "Nguyên tắc bắt buộc"). */
@Module({
  imports: [AuditModule, JobsModule, StorageModule, CommunityModule],
  controllers: [
    ResourcesController,
    ResourceVersionsController,
    AnnotationsController,
    ResourceAccessGrantsController,
  ],
  providers: [
    ResourcesRepository,
    ResourcesService,
    AnnotationsRepository,
    AnnotationsService,
    ResourceAccessGrantsRepository,
    ResourceAccessGrantsService,
  ],
  // Exported for `technology-case/evidence.service.ts` (UC-EVD-01 must confirm the
  // actor can read a resource version before linking it as evidence) — same DI-export
  // requirement as the aggregator modules in identity-organization/platform-operations,
  // see README "Bug thật đã tìm và sửa" #5.
  exports: [ResourcesRepository, ResourcesService],
})
export class ResourceCatalogModule {}
