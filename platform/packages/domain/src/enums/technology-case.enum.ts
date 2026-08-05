/** Chính thức trong §8 R2M_SPEC_DESIGN_V5_COMPLETE.md — 10 trạng thái nối tiếp. Phase 3
 * chỉ thực sự dùng tới `EVIDENCE_COLLECTION`; các trạng thái sau (Assessment/Gap/
 * Roadmap/Transfer) thuộc Phase 4-6, giữ đủ ở đây để không phải sửa lại giá trị enum khi
 * mở rộng. */
export const TechnologyCaseStatus = {
  DRAFT: "DRAFT",
  EVIDENCE_COLLECTION: "EVIDENCE_COLLECTION",
  UNDER_ASSESSMENT: "UNDER_ASSESSMENT",
  GAP_IDENTIFIED: "GAP_IDENTIFIED",
  ROADMAP_DRAFT: "ROADMAP_DRAFT",
  ROADMAP_APPROVED: "ROADMAP_APPROVED",
  PILOT_READY: "PILOT_READY",
  TRANSFER_READY: "TRANSFER_READY",
  COMMERCIALIZED: "COMMERCIALIZED",
  ARCHIVED: "ARCHIVED",
} as const;
export type TechnologyCaseStatus = (typeof TechnologyCaseStatus)[keyof typeof TechnologyCaseStatus];

/** Phase 3 chỉ tạo được `MANUAL` — 3 giá trị còn lại cần cột FK tới bảng Phase 5
 * (`recommendation_item`/`research_proposal`/`case_initiation_request`) chưa tồn tại,
 * xem `packages/database/src/schema/technology-case.ts`. */
export const CaseOriginType = {
  MANUAL: "MANUAL",
  DISCOVERY_RECOMMENDATION: "DISCOVERY_RECOMMENDATION",
  RESEARCH_PROPOSAL: "RESEARCH_PROPOSAL",
  IMPORT: "IMPORT",
} as const;
export type CaseOriginType = (typeof CaseOriginType)[keyof typeof CaseOriginType];

export const CaseOrganizationRole = {
  OWNING_ORGANIZATION: "OWNING_ORGANIZATION",
  PARTNER_COMPANY: "PARTNER_COMPANY",
  REVIEW_ORGANIZATION: "REVIEW_ORGANIZATION",
  SUPPORT_ORGANIZATION: "SUPPORT_ORGANIZATION",
} as const;
export type CaseOrganizationRole = (typeof CaseOrganizationRole)[keyof typeof CaseOrganizationRole];

export const CaseMemberRole = {
  OWNER: "OWNER",
  TECHNICAL_MEMBER: "TECHNICAL_MEMBER",
  CASE_REVIEWER: "CASE_REVIEWER",
  PARTNER_MEMBER: "PARTNER_MEMBER",
  VIEWER: "VIEWER",
} as const;
export type CaseMemberRole = (typeof CaseMemberRole)[keyof typeof CaseMemberRole];

export const EvidenceStatus = {
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
  REJECTED: "REJECTED",
} as const;
export type EvidenceStatus = (typeof EvidenceStatus)[keyof typeof EvidenceStatus];

export const VisibilityLevel = {
  PUBLIC: "PUBLIC",
  ORGANIZATION_ONLY: "ORGANIZATION_ONLY",
  PARTNERS_ONLY: "PARTNERS_ONLY",
  PRIVATE: "PRIVATE",
} as const;
export type VisibilityLevel = (typeof VisibilityLevel)[keyof typeof VisibilityLevel];
