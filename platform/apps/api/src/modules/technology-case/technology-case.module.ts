import { Module } from "@nestjs/common";
import { ResourceCatalogModule } from "../resource-catalog/resource-catalog.module";
import { AuditModule } from "../platform-operations/audit/audit.module";
import { JobsModule } from "../platform-operations/jobs/jobs.module";
import { PlatformTechnologyCasesController, TechnologyCasesController } from "./technology-case.controller";
import { TechnologyCaseRepository } from "./technology-case.repository";
import { TechnologyCaseService } from "./technology-case.service";
import { EvidenceRepository } from "./evidence.repository";
import { EvidenceService } from "./evidence.service";

/** Technology Case bounded context — 1 NestJS module, 1 controller (mirrors the
 * `verification/` pattern: no aggregator needed, only one real module here — see
 * CLAUDE.md "Nguyên tắc bắt buộc"). Imports `ResourceCatalogModule` (which now
 * `exports` `ResourcesService`/`ResourcesRepository`) so `EvidenceService` can reuse
 * `assertVisible` for UC-EVD-01's "actor có quyền đọc resource" check. */
@Module({
  imports: [AuditModule, JobsModule, ResourceCatalogModule],
  controllers: [TechnologyCasesController, PlatformTechnologyCasesController],
  providers: [TechnologyCaseRepository, TechnologyCaseService, EvidenceRepository, EvidenceService],
  // Exported for `modules/assessment-gap` and `modules/roadmap-transfer` (Phase 4) —
  // both reuse `TechnologyCaseService.applyTransition` for the case lifecycle cascades
  // (UNDER_ASSESSMENT/GAP_IDENTIFIED/ROADMAP_DRAFT/ROADMAP_APPROVED) exactly the way
  // `EvidenceService` already does for EVIDENCE_COLLECTION — same DI-export requirement
  // as the aggregator modules, see README "Bug thật đã tìm và sửa" #5.
  // `EvidenceRepository` additionally exported for `modules/company-discovery`
  // (Sprint 5.6) — `CaseInitiationsService.accept` reuses `createEvidence`/
  // `createEvidenceCitation` directly to turn a recommendation's existing citation into
  // the new case's starting evidence, without creating a duplicate citation.
  exports: [TechnologyCaseRepository, TechnologyCaseService, EvidenceRepository],
})
export class TechnologyCaseModule {}
