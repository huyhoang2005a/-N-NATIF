export const ResearchNeedStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ResearchNeedStatus = (typeof ResearchNeedStatus)[keyof typeof ResearchNeedStatus];

export const ProposalStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export const RecommendationRunStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type RecommendationRunStatus = (typeof RecommendationRunStatus)[keyof typeof RecommendationRunStatus];

export const RecommendationItemStatus = {
  ACTIVE: "ACTIVE",
  DISMISSED: "DISMISSED",
  SELECTED: "SELECTED",
} as const;
export type RecommendationItemStatus = (typeof RecommendationItemStatus)[keyof typeof RecommendationItemStatus];

export const CaseInitiationStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type CaseInitiationStatus = (typeof CaseInitiationStatus)[keyof typeof CaseInitiationStatus];

export const RecommendationRunType = {
  FOCUSED: "FOCUSED",
  FEED: "FEED",
} as const;
export type RecommendationRunType = (typeof RecommendationRunType)[keyof typeof RecommendationRunType];
