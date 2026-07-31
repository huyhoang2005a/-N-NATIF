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

export type DomainEvent =
  | OrganizationRegisteredEvent
  | OrganizationVerificationRequestedEvent
  | OrganizationActivatedEvent
  | OrganizationVerificationRejectedEvent
  | OrganizationMemberInvitedEvent
  | OrganizationMemberRoleChangedEvent
  | UserProfileUpdatedEvent;
