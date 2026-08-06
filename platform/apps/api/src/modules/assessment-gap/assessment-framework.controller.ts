import type { AssessmentCriterionResponse, AssessmentFrameworkResponse } from "@r2m/contracts";
import { ErrorCode, NotFoundError } from "@r2m/domain";
import { Controller, Get, Param } from "@nestjs/common";
import { AssessmentFrameworkRepository } from "./assessment-framework.repository";

function toFrameworkResponse(row: {
  id: string;
  code: string;
  name: string;
  versionNo: number;
  description: string | null;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  activatedAt: Date | null;
  retiredAt: Date | null;
}): AssessmentFrameworkResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    versionNo: row.versionNo,
    description: row.description,
    status: row.status,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    activatedAt: row.activatedAt?.toISOString() ?? null,
    retiredAt: row.retiredAt?.toISOString() ?? null,
  };
}

function toCriterionResponse(row: {
  id: string;
  frameworkId: string;
  categoryCode: string;
  criterionCode: string;
  title: string;
  description: string;
  guidance: string | null;
  minScore: string;
  maxScore: string;
  weight: string;
  requiresEvidence: boolean;
  requiresCitation: boolean;
  sortOrder: number;
}): AssessmentCriterionResponse {
  return {
    id: row.id,
    frameworkId: row.frameworkId,
    categoryCode: row.categoryCode,
    criterionCode: row.criterionCode,
    title: row.title,
    description: row.description,
    guidance: row.guidance,
    minScore: Number(row.minScore),
    maxScore: Number(row.maxScore),
    weight: Number(row.weight),
    requiresEvidence: row.requiresEvidence,
    requiresCitation: row.requiresCitation,
    sortOrder: row.sortOrder,
  };
}

/** Đọc thuần — không có business rule, không cần actor/case scoping (framework/criterion
 * không thuộc riêng 1 case nào). Thêm khi làm UI Phase 4 — trước đó chưa có endpoint nào
 * expose framework/criterion, UI không biết criterion nào cần nhập điểm. */
@Controller("assessment-frameworks")
export class AssessmentFrameworksController {
  constructor(private readonly frameworkRepository: AssessmentFrameworkRepository) {}

  @Get(":id")
  async getById(@Param("id") id: string): Promise<AssessmentFrameworkResponse> {
    const framework = await this.frameworkRepository.findById(id);
    if (!framework) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_FRAMEWORK_NOT_FOUND, "Assessment framework not found.");
    }
    return toFrameworkResponse(framework);
  }

  @Get(":id/criteria")
  async listCriteria(@Param("id") id: string): Promise<AssessmentCriterionResponse[]> {
    const framework = await this.frameworkRepository.findById(id);
    if (!framework) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_FRAMEWORK_NOT_FOUND, "Assessment framework not found.");
    }
    const rows = await this.frameworkRepository.findCriteriaByFramework(id);
    return rows.map(toCriterionResponse);
  }
}
