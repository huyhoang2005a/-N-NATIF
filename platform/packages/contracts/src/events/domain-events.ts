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

/** Community đợt 3 — follow. `followerUserId` is who did the following, not the
 * notification recipient — the recipient is the followed author/org (see
 * `outbox-dispatcher.ts` handler). */
export interface AuthorFollowedEvent {
  type: "AuthorFollowed";
  followerUserId: string;
  followedAuthorUserId: string;
}

export interface OrganizationFollowedEvent {
  type: "OrganizationFollowed";
  followerUserId: string;
  followedOrganizationId: string;
}

/** Phase 6 Sprint 6.1 — transfer manifest lifecycle. Audit-trail event, no reader-facing
 * notification yet (worker treats it as a no-op, same as e.g. `TechnologyCaseCreated`) —
 * only `TransferManifestSharedEvent` (Sprint 6.2) notifies recipients. */
export interface TransferManifestCreatedEvent {
  type: "TransferManifestCreated";
  transferManifestId: string;
  technologyCaseId: string;
  createdByUserId: string;
}

/** Phase 6 Sprint 6.2 — fires once per share (not once per recipient), carries both id
 * lists so the worker can notify each recipient individually. */
export interface TransferManifestSharedEvent {
  type: "TransferManifestShared";
  transferManifestId: string;
  technologyCaseId: string;
  recipientUserIds: string[];
  recipientOrganizationIds: string[];
}

/** No reader-facing notification requirement in UC-TRF-01 for revoke (only share
 * notifies) — worker treats this as audit-trail only, same as `TransferManifestCreated`. */
export interface TransferAccessRevokedEvent {
  type: "TransferAccessRevoked";
  transferManifestId: string;
  technologyCaseId: string;
  revokedByUserId: string;
}

/** Phase 6 Sprint 6.3. Notifies active platform reviewers, same precedent as
 * `AuthorVerificationSubmittedEvent`/`OrganizationVerificationRequestedEvent`. */
export interface ContentFlagCreatedEvent {
  type: "ContentFlagCreated";
  contentFlagId: string;
  targetType: string;
  reporterUserId: string;
}

/** UC-MOD-01 acceptance criteria: "Owner/reporter nhận notification". Carries the raw
 * target reference (not a resolved owner id) — the worker resolves current ownership at
 * dispatch time via `findContentOwnerUserId` (`notify.ts`), same "resolve at dispatch,
 * not at emit" pattern as `OrganizationFollowedEvent` resolving org owners. */
export interface ModerationDecisionRecordedEvent {
  type: "ModerationDecisionRecorded";
  contentFlagId: string;
  targetType: string;
  targetResourceId: string | null;
  targetAnnotationId: string | null;
  targetTechnologyProfileId: string | null;
  reporterUserId: string;
  action: string;
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
  | CaseInitiationRequestDecidedEvent
  | AuthorFollowedEvent
  | OrganizationFollowedEvent
  | TransferManifestCreatedEvent
  | TransferManifestSharedEvent
  | TransferAccessRevokedEvent
  | ContentFlagCreatedEvent
  | ModerationDecisionRecordedEvent;
