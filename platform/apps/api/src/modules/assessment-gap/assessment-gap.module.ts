import { Module } from "@nestjs/common";
import { TechnologyCaseModule } from "../technology-case/technology-case.module";
import { AuditModule } from "../platform-operations/audit/audit.module";
import { JobsModule } from "../platform-operations/jobs/jobs.module";
import { AssessmentGapCaseController, AssessmentsController, GapsController } from "./assessment-gap.controller";
import { AssessmentFrameworkRepository } from "./assessment-framework.repository";
import { AssessmentRepository } from "./assessment.repository";
import { AssessmentService } from "./assessment.service";
import { GapRepository } from "./gap.repository";
import { GapService } from "./gap.service";

/** Assessment & Gap bounded context (§9.6) — 1 NestJS module, 3 controller (mirrors
 * `resource-catalog/` pattern: nhiều controller, không cần aggregator vì chỉ có 1
 * module thật). Imports `TechnologyCaseModule` (exports `TechnologyCaseRepository`/
 * `TechnologyCaseService` từ Phase 4) để tái dùng `applyTransition`/`assertVisible`. */
@Module({
  imports: [AuditModule, JobsModule, TechnologyCaseModule],
  controllers: [AssessmentGapCaseController, AssessmentsController, GapsController],
  providers: [AssessmentFrameworkRepository, AssessmentRepository, AssessmentService, GapRepository, GapService],
  // Exported for `modules/roadmap-transfer` — RoadmapService reads open CRITICAL gaps
  // for the approval gate (`validate_roadmap_approval` ported to app layer).
  exports: [GapRepository],
})
export class AssessmentGapModule {}
