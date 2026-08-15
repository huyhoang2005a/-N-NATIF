import { Module } from "@nestjs/common";
import { TechnologyCaseModule } from "../technology-case/technology-case.module";
import { AssessmentGapModule } from "../assessment-gap/assessment-gap.module";
import { AssistantModule } from "../assistant/assistant.module";
import { AuditModule } from "../platform-operations/audit/audit.module";
import { JobsModule } from "../platform-operations/jobs/jobs.module";
import { ResourceCatalogModule } from "../resource-catalog/resource-catalog.module";
import { MilestonesController, RoadmapCaseController, RoadmapsController } from "./roadmap.controller";
import { RoadmapRepository } from "./roadmap.repository";
import { RoadmapService } from "./roadmap.service";
import { TransferManifestCaseController, TransferManifestsController } from "./transfer/transfer.controller";
import { TransferManifestRepository } from "./transfer/transfer.repository";
import { TransferManifestService } from "./transfer/transfer.service";

/** Roadmap & Transfer bounded context (§9.7) — Roadmap (Phase 4) + Transfer (Phase 6,
 * thêm vào module này, không đổi tên — đúng tiền lệ `verification/`). Imports
 * `TechnologyCaseModule` (applyTransition/assertVisible, cũng dùng cho Transfer's Case
 * Owner check), `AssessmentGapModule` (đọc CRITICAL gap còn mở cho gate approve roadmap),
 * và `ResourceCatalogModule` (Sprint 6.2 — `TransferManifestService.share()` tạo
 * `resource_access_grant` qua `ResourceAccessGrantsRepository` đã export). */
@Module({
  imports: [AuditModule, JobsModule, TechnologyCaseModule, AssessmentGapModule, ResourceCatalogModule, AssistantModule],
  controllers: [RoadmapCaseController, RoadmapsController, MilestonesController, TransferManifestCaseController, TransferManifestsController],
  providers: [RoadmapRepository, RoadmapService, TransferManifestRepository, TransferManifestService],
})
export class RoadmapTransferModule {}
