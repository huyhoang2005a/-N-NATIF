/**
 * Domain event payloads written to `outbox_event` in the same transaction as the state
 * change that produced them (architecture plan §11 / §14.2). Event `type` strings are the
 * stable identifiers consumed by apps/worker.
 */

export interface OrganizationRegisteredEvent {
  type: "OrganizationRegistered";
  organizationId: string;
  ownerUserId: string;
  organizationType: string;
  requiresManualVerification: boolean;
}

export interface OrganizationVerificationRequestedEvent {
  type: "OrganizationVerificationRequested";
  organizationId: string;
  verificationRequestId: string;
  submittedByUserId: string;
}

export interface OrganizationActivatedEvent {
  type: "OrganizationActivated";
  organizationId: string;
  verificationRequestId: string;
  reviewerUserId: string;
}

export interface OrganizationVerificationRejectedEvent {
  type: "OrganizationVerificationRejected";
  organizationId: string;
  verificationRequestId: string;
  reviewerUserId: string;
  reason: string;
}

export interface OrganizationJoinRequestedEvent {
  type: "OrganizationJoinRequested";
  organizationId: string;
  memberId: string;
  requestingUserId: string;
}

export interface OrganizationJoinRequestDecidedEvent {
  type: "OrganizationJoinRequestDecided";
  organizationId: string;
  memberId: string;
  userId: string;
  decision: "APPROVED" | "REJECTED";
}

export interface OrganizationMemberInvitedEvent {
  type: "OrganizationMemberInvited";
  organizationId: string;
  memberId: string;
  invitedUserId: string;
  invitedByUserId: string;
  role: string;
}

export interface OrganizationMemberRoleChangedEvent {
  type: "OrganizationMemberRoleChanged";
  organizationId: string;
  memberId: string;
  previousRole: string;
  newRole: string;
  changedByUserId: string;
}

export interface UserProfileUpdatedEvent {
  type: "UserProfileUpdated";
  userId: string;
  changedFields: string[];
}

export interface EmailVerificationRequestedEvent {
  type: "EmailVerificationRequested";
  userId: string;
  email: string;
  /** Raw token — only ever persisted here (outbox_event.payload) and in the email itself,
   * never in audit_log or application logs. */
  token: string;
  expiresAt: string;
}

export interface AuthorVerificationSubmittedEvent {
  type: "AuthorVerificationSubmitted";
  authorUserId: string;
  verificationRequestId: string;
}

export interface AuthorVerifiedEvent {
  type: "AuthorVerified";
  authorUserId: string;
  verificationRequestId: string;
  reviewerUserId: string;
}

export interface AuthorVerificationRejectedEvent {
  type: "AuthorVerificationRejected";
  authorUserId: string;
  verificationRequestId: string;
  reviewerUserId: string;
  reason: string;
}

export interface ResourceRegisteredEvent {
  type: "ResourceRegistered";
  resourceId: string;
  ownerOrganizationId: string;
  createdByUserId: string;
}

export interface ResourceVersionPublishedEvent {
  type: "ResourceVersionPublished";
  resourceId: string;
  resourceVersionId: string;
  versionNo: number;
}

export interface ResourceIngestionQueuedEvent {
  type: "ResourceIngestionQueued";
  resourceVersionId: string;
  ingestionJobId: string;
}

export interface AnnotationCreatedEvent {
  type: "AnnotationCreated";
  annotationId: string;
  resourceVersionId: string;
  createdByUserId: string;
}

export interface AnnotationRevisedEvent {
  type: "AnnotationRevised";
  annotationId: string;
  previousRevisionNo: number;
  newRevisionNo: number;
}

export interface AnnotationRemovedEvent {
  type: "AnnotationRemoved";
  annotationId: string;
  removedByUserId: string;
}

export interface ResourceAccessGrantedEvent {
  type: "ResourceAccessGranted";
  accessGrantId: string;
  resourceId: string;
  grantedByUserId: string;
}

export interface ResourceAccessRevokedEvent {
  type: "ResourceAccessRevoked";
  accessGrantId: string;
  resourceId: string;
  revokedByUserId: string;
}

export interface TechnologyCaseCreatedEvent {
  type: "TechnologyCaseCreated";
  technologyCaseId: string;
  owningOrganizationId: string;
  createdByUserId: string;
}

export interface CaseStatusChangedEvent {
  type: "CaseStatusChanged";
  technologyCaseId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: string;
}

export interface EvidenceLinkedEvent {
  type: "EvidenceLinked";
  evidenceId: string;
  technologyCaseId: string;
  resourceVersionId: string;
  createdByUserId: string;
}

export interface AssessmentSubmittedEvent {
  type: "AssessmentSubmitted";
  assessmentId: string;
  technologyCaseId: string;
  compositeScore: number;
  submittedByUserId: string;
}

export interface AssessmentApprovedEvent {
  type: "AssessmentApproved";
  assessmentId: string;
  technologyCaseId: string;
  approvedByUserId: string;
}

export interface CriticalGapRaisedEvent {
  type: "CriticalGapRaised";
  gapRecordId: string;
  technologyCaseId: string;
  createdByUserId: string;
}

export interface RoadmapApprovedEvent {
  type: "RoadmapApproved";
  roadmapId: string;
  technologyCaseId: string;
  approvedByUserId: string;
}

/** Phase 5 Sprint 5.4/5.5 — dùng chung cho cả `runType` FOCUSED và FEED, phân biệt qua
 * payload (chỉ 1 trong 2 cặp {researchNeedId} / {companyOrganizationId} có giá trị, đúng
 * CHECK constraint `chk_recommendation_run_context_matches_type`). */
export interface RecommendationRunRequestedEvent {
  type: "RecommendationRunRequested";
  recommendationRunId: string;
  runType: string;
  researchNeedId: string | null;
  companyOrganizationId: string | null;
}

export interface RecommendationRunCompletedEvent {
  type: "RecommendationRunCompleted";
  recommendationRunId: string;
  runType: string;
  status: string;
  itemCount: number;
}

export interface CaseInitiationRequestedEvent {
  type: "CaseInitiationRequested";
  caseInitiationRequestId: string;
  recommendationItemId: string;
  requestingOrganizationId: string;
  targetAuthorUserId: string;
}

export interface CaseInitiationRequestDecidedEvent {
  type: "CaseInitiationRequestDecided";
  caseInitiationRequestId: string;
  decision: "ACCEPTED" | "DECLINED" | "EXPIRED";
  requestingOrganizationId: string;
  requestedByUserId: string;
}

export type DomainEvent =
  | OrganizationRegisteredEvent
  | OrganizationVerificationRequestedEvent
  | OrganizationActivatedEvent
  | OrganizationVerificationRejectedEvent
  | OrganizationJoinRequestedEvent
  | OrganizationJoinRequestDecidedEvent
  | OrganizationMemberInvitedEvent
  | OrganizationMemberRoleChangedEvent
  | UserProfileUpdatedEvent
  | EmailVerificationRequestedEvent
  | AuthorVerificationSubmittedEvent
  | AuthorVerifiedEvent
  | AuthorVerificationRejectedEvent
  | ResourceRegisteredEvent
  | ResourceVersionPublishedEvent
  | ResourceIngestionQueuedEvent
  | AnnotationCreatedEvent
  | AnnotationRevisedEvent
  | AnnotationRemovedEvent
  | ResourceAccessGrantedEvent
  | ResourceAccessRevokedEvent
  | TechnologyCaseCreatedEvent
  | CaseStatusChangedEvent
  | EvidenceLinkedEvent
  | AssessmentSubmittedEvent
  | AssessmentApprovedEvent
  | CriticalGapRaisedEvent
  | RoadmapApprovedEvent
  | RecommendationRunRequestedEvent
  | RecommendationRunCompletedEvent
  | CaseInitiationRequestedEvent
  | CaseInitiationRequestDecidedEvent;
