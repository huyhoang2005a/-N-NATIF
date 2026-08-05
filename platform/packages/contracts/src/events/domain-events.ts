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

export type DomainEvent =
  | OrganizationRegisteredEvent
  | OrganizationVerificationRequestedEvent
  | OrganizationActivatedEvent
  | OrganizationVerificationRejectedEvent
  | OrganizationMemberInvitedEvent
  | OrganizationMemberRoleChangedEvent
  | UserProfileUpdatedEvent
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
  | EvidenceLinkedEvent;
