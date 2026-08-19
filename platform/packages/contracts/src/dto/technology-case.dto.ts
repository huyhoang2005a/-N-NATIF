import { CaseMemberRole, CaseOrganizationRole, TechnologyCaseStatus } from "@r2m/domain";
import { z } from "zod";

const caseMemberRoleValues = Object.values(CaseMemberRole) as [CaseMemberRole, ...CaseMemberRole[]];
const caseOrganizationRoleValues = Object.values(CaseOrganizationRole) as [
  CaseOrganizationRole,
  ...CaseOrganizationRole[],
];
const technologyCaseStatusValues = Object.values(TechnologyCaseStatus) as [
  TechnologyCaseStatus,
  ...TechnologyCaseStatus[],
];

/** UC-CASE-01 input: "Title, summary, technology type, owner organization, optional
 * initial resources." `summary` maps to `technology_profile.summary` (dbml has no
 * dedicated "technology type" column — schema is the source of truth, see plan PHẦN
 * C.5). Initial resources are out of scope for the register endpoint — evidence is
 * added afterwards via `POST /technology-cases/{id}/evidence`. */
export const RegisterTechnologyCaseRequestSchema = z.object({
  owningOrganizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  summary: z.string().trim().optional(),
});
export type RegisterTechnologyCaseRequest = z.infer<typeof RegisterTechnologyCaseRequestSchema>;

export const AddCaseMemberRequestSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: z.enum(caseMemberRoleValues),
});
export type AddCaseMemberRequest = z.infer<typeof AddCaseMemberRequestSchema>;

/** `OWNING_ORGANIZATION` bị loại — role đó chỉ được hệ thống tự tạo lúc register case
 * (đúng 1 owning org / case), endpoint này chỉ dùng để thêm partner/review/support org
 * (SUC-06). */
export const AddCaseOrganizationRequestSchema = z.object({
  organizationId: z.string().uuid(),
  role: z.enum(
    caseOrganizationRoleValues.filter((role) => role !== "OWNING_ORGANIZATION") as [
      CaseOrganizationRole,
      ...CaseOrganizationRole[],
    ],
  ),
});
export type AddCaseOrganizationRequest = z.infer<typeof AddCaseOrganizationRequestSchema>;

/** SUC-07 — Phase 3 chỉ thực sự thực thi target `EVIDENCE_COLLECTION` (transition tự
 * động khi có evidence đầu tiên); các target khác bị service từ chối
 * (`CASE_INVALID_TRANSITION`) vì cần dữ liệu Phase 4+ chưa tồn tại — xem
 * technology-case.state-machine.ts. */
export const TransitionCaseRequestSchema = z.object({
  toStatus: z.enum(technologyCaseStatusValues),
  reason: z.string().trim().max(2000).optional(),
});
export type TransitionCaseRequest = z.infer<typeof TransitionCaseRequestSchema>;

/** UC-EVD-01 input: "Resource version, claim/description, annotation optional
 * reference, citation locator/snippet." Citation luôn được tạo mới ở Phase 3 (không
 * dedupe — xem plan PHẦN C, quyết định 7). */
const citationLocatorFields = {
  snippet: z.string().trim().min(1),
  pageNumber: z.number().int().nonnegative().optional(),
  sectionLabel: z.string().trim().max(255).optional(),
  offsetStart: z.number().int().nonnegative().optional(),
  offsetEnd: z.number().int().nonnegative().optional(),
};

export const CreateEvidenceRequestSchema = z.object({
  resourceVersionId: z.string().uuid(),
  annotationId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255),
  claim: z.string().trim().min(1),
  relevanceNote: z.string().trim().min(1),
  citation: z.object(citationLocatorFields),
});
export type CreateEvidenceRequest = z.infer<typeof CreateEvidenceRequestSchema>;

export interface TechnologyCaseResponse {
  id: string;
  owningOrganizationId: string;
  title: string;
  slug: string;
  description: string | null;
  lifecycleStatus: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  version: number;
}

export interface CaseMemberResponse {
  id: string;
  technologyCaseId: string;
  userId: string;
  organizationId: string;
  role: string;
  status: string;
  invitedByUserId: string | null;
  joinedAt: string;
  createdAt: string;
}

export interface CaseOrganizationResponse {
  id: string;
  technologyCaseId: string;
  organizationId: string;
  role: string;
  joinedAt: string;
  /** Denormalized (2026-08-19 fix) — `GET /technology-cases/:id/organizations` is gated on
   * the CASE's own visibility (`assertVisible`: case_member OR any linked org's member OR
   * platform reviewer/admin), which is broader than "member of this specific org". The
   * frontend previously called `GET /organizations/:id` per linked org to get its name,
   * which 403s for a legitimate case viewer who can see the case but isn't a member of
   * every org linked to it (e.g. a partner-org member looking up the owning org's name) —
   * denormalizing the name here means the case detail page never needs that per-org call. */
  organizationName: string;
  organizationSlug: string;
}

export interface EvidenceResponse {
  id: string;
  technologyCaseId: string;
  resourceVersionId: string;
  annotationId: string | null;
  title: string;
  claim: string;
  relevanceNote: string;
  status: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /platform/technology-cases/summary` (admin-only) — not spec-mandated, powers the
 * admin dashboard's case-count stat tile without a full platform-wide case list.
 * `byStatus` (added for the dashboard's status-breakdown chart) always has one entry per
 * `technology_case_status` enum value, including 0-counts. */
export interface PlatformCaseSummaryResponse {
  total: number;
  active: number;
  byStatus: Record<string, number>;
}
