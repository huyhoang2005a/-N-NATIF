import { Module } from "@nestjs/common";
import { TechnologyCaseModule } from "../technology-case/technology-case.module";
import { AssessmentGapModule } from "../assessment-gap/assessment-gap.module";
import { AuditModule } from "../platform-operations/audit/audit.module";
import { JobsModule } from "../platform-operations/jobs/jobs.module";
import { MilestonesController, RoadmapCaseController, RoadmapsController } from "./roadmap.controller";
import { RoadmapRepository } from "./roadmap.repository";
import { RoadmapService } from "./roadmap.service";

/** Roadmap & Transfer bounded context (§9.7) — chỉ phần Roadmap ở Phase 4 (Transfer
 * thuộc Phase 6, thêm vào module này sau, không đổi tên — đúng tiền lệ `verification/`).
 * Imports `TechnologyCaseModule` (applyTransition/assertVisible) và
 * `AssessmentGapModule` (đọc CRITICAL gap còn mở cho gate approve roadmap). */
@Module({
  imports: [AuditModule, JobsModule, TechnologyCaseModule, AssessmentGapModule],
  controllers: [RoadmapCaseController, RoadmapsController, MilestonesController],
  providers: [RoadmapRepository, RoadmapService],
})
export class RoadmapTransferModule {}
