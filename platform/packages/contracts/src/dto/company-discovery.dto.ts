import { VisibilityLevel } from "@r2m/domain";
import { z } from "zod";

const visibilityLevelValues = Object.values(VisibilityLevel) as [VisibilityLevel, ...VisibilityLevel[]];

// ---------- Sprint 5.1: Company Profile ----------

export const CreateCompanyProfileRequestSchema = z.object({
  industryCode: z.string().trim().max(100).optional(),
  companySize: z.string().trim().max(50).optional(),
  description: z.string().trim().max(4000).optional(),
});
export type CreateCompanyProfileRequest = z.infer<typeof CreateCompanyProfileRequestSchema>;

export const UpdateCompanyProfileRequestSchema = CreateCompanyProfileRequestSchema;
export type UpdateCompanyProfileRequest = z.infer<typeof UpdateCompanyProfileRequestSchema>;

export interface CompanyProfileResponse {
  organizationId: string;
  publicSlug: string;
  industryCode: string | null;
  companySize: string | null;
  description: string | null;
  contactUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Sprint 5.2: Research Need ----------

const needStatementFields = {
  problemStatement: z.string().trim().min(1),
  technicalField: z.string().trim().min(1).max(150),
  desiredOutputType: z.string().trim().min(1).max(100),
  timeframeMonths: z.number().int().positive().optional(),
  constraints: z.string().trim().max(4000).optional(),
  successCriteria: z.string().trim().max(4000).optional(),
};

export const CreateResearchNeedRequestSchema = z.object({
  companyOrganizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  visibility: z.enum(visibilityLevelValues).optional(),
  ...needStatementFields,
});
export type CreateResearchNeedRequest = z.infer<typeof CreateResearchNeedRequestSchema>;

export const CreateNeedStatementVersionRequestSchema = z.object(needStatementFields);
export type CreateNeedStatementVersionRequest = z.infer<typeof CreateNeedStatementVersionRequestSchema>;

export interface NeedStatementVersionResponse {
  id: string;
  researchNeedId: string;
  versionNo: number;
  problemStatement: string;
  technicalField: string;
  desiredOutputType: string;
  timeframeMonths: number | null;
  constraints: string | null;
  successCriteria: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface ResearchNeedResponse {
  id: string;
  companyOrganizationId: string;
  createdByUserId: string;
  title: string;
  visibility: string;
  status: string;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  /** Community layer (đợt 1) — see `ResourceResponse.voteCount`/`.votedByMe`. */
  voteCount: number;
  votedByMe: boolean;
  /** Community layer (đợt 2) — see `ResourceResponse.savedByMe`. */
  savedByMe: boolean;
}

export interface ResearchNeedDetailResponse extends ResearchNeedResponse {
  currentVersion: NeedStatementVersionResponse;
}

/** `GET /research-needs/fields` (Cộng đồng đợt 7 — duyệt theo lĩnh vực kỹ thuật). `field`
 * is each need's LATEST version's `technicalField`, `count` = how many OPEN+PUBLIC needs
 * currently sit under it. */
export interface TechnicalFieldSummaryResponse {
  field: string;
  count: number;
}

// ---------- Sprint 5.3: Research Proposal ----------

export const CreateResearchProposalRequestSchema = z.object({
  proposerOrganizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  abstract: z.string().trim().min(1),
  methodology: z.string().trim().min(1),
  expectedOutcome: z.string().trim().min(1),
  timelineMonths: z.number().int().positive(),
});
export type CreateResearchProposalRequest = z.infer<typeof CreateResearchProposalRequestSchema>;

export const RejectResearchProposalRequestSchema = z.object({
  decisionReason: z.string().trim().min(1).max(2000),
});
export type RejectResearchProposalRequest = z.infer<typeof RejectResearchProposalRequestSchema>;

export interface ResearchProposalResponse {
  id: string;
  researchNeedId: string;
  needStatementVersionId: string;
  proposerAuthorUserId: string;
  proposerOrganizationId: string;
  title: string;
  abstract: string;
  methodology: string;
  expectedOutcome: string;
  timelineMonths: number;
  status: string;
  submittedAt: string | null;
  decidedByUserId: string | null;
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// ---------- Sprint 5.4: AI Recommendation (FOCUSED) ----------

export interface RecommendationRunResponse {
  id: string;
  researchNeedId: string | null;
  needStatementVersionId: string | null;
  companyOrganizationId: string | null;
  runType: string;
  requestedByUserId: string;
  status: string;
  modelProvider: string | null;
  modelName: string | null;
  promptVersion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface RecommendationCitationResponse {
  id: string;
  citationId: string;
  resourceVersionId: string;
  snippet: string;
}

export interface RecommendationItemResponse {
  id: string;
  recommendationRunId: string;
  resourceVersionId: string;
  rank: number;
  matchScore: number;
  rationale: string;
  status: string;
  citations: RecommendationCitationResponse[];
  createdAt: string;
  /** §3 Sprint 5.7 item 24 — card summary. `resourceTitle`/`resourceType` for display,
   * `summary` = PAPER's `paper_metadata.abstract` or `resource.description` otherwise
   * (null if neither is set — no placeholder text), `publicationDate` only set for PAPER. */
  resourceTitle: string;
  resourceType: string;
  summary: string | null;
  publicationDate: string | null;
}

// ---------- Sprint 5.6: Case Initiation ----------

export const CreateCaseInitiationRequestSchema = z.object({
  message: z.string().trim().max(2000).optional(),
});
export type CreateCaseInitiationRequest = z.infer<typeof CreateCaseInitiationRequestSchema>;

/** Resource-sourced creation (2026-08-19) — sent from `/resources/:id/versions/:versionId/
 * case-initiation-requests` when a company browses a resource directly, with no
 * recommendation run to infer the requesting company org from. `requestingOrganizationId`
 * is therefore explicit here, same pattern as `CreateResearchProposalRequestSchema.
 * proposerOrganizationId` above — an actor can belong to multiple ENTERPRISE orgs, so it
 * must never be guessed. */
export const CreateResourceCaseInitiationRequestSchema = z.object({
  requestingOrganizationId: z.string().uuid(),
  message: z.string().trim().max(2000).optional(),
});
export type CreateResourceCaseInitiationRequest = z.infer<typeof CreateResourceCaseInitiationRequestSchema>;

export const DeclineCaseInitiationRequestSchema = z.object({
  responseNote: z.string().trim().max(2000).optional(),
});
export type DeclineCaseInitiationRequest = z.infer<typeof DeclineCaseInitiationRequestSchema>;

export interface CaseInitiationRequestResponse {
  id: string;
  recommendationItemId: string | null;
  /** Resource-sourced requests only (2026-08-19) — null for the original
   * recommendation-item-sourced path. Exactly one of `recommendationItemId`/
   * `resourceVersionId` is ever non-null. */
  resourceVersionId: string | null;
  /** Title of the resource this request is about, resolved server-side from whichever
   * source is set — lets the author's inbox show "what is this about" without the
   * frontend needing to know which source branch produced the request. */
  resourceTitle: string;
  requestingOrganizationId: string;
  requestedByUserId: string;
  targetAuthorUserId: string;
  targetOrganizationId: string;
  status: string;
  message: string | null;
  responseNote: string | null;
  respondedByUserId: string | null;
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}
