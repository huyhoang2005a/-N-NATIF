import { relations } from "drizzle-orm";
import { userAccount, userIdentity, userProfile } from "./identity";
import { organization, organizationDomain, organizationMember, organizationVerificationRequest } from "./organization";
import { authorProfile, authorVerificationRequest } from "./author";
import { verificationDocument } from "./verification";
import {
  annotation,
  annotationRevision,
  citation,
  paperMetadata,
  resource,
  resourceAccessGrant,
  resourceChunk,
  resourceIngestionJob,
  resourceVersion,
} from "./resource";
import type { outboxEvent } from "./platform-ops";
import { auditLog, idempotencyKey, notification } from "./platform-ops";

export const userAccountRelations = relations(userAccount, ({ many, one }) => ({
  identities: many(userIdentity),
  profile: one(userProfile, {
    fields: [userAccount.id],
    references: [userProfile.userId],
  }),
  memberships: many(organizationMember),
}));

export const userIdentityRelations = relations(userIdentity, ({ one }) => ({
  user: one(userAccount, {
    fields: [userIdentity.userId],
    references: [userAccount.id],
  }),
}));

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(userAccount, {
    fields: [userProfile.userId],
    references: [userAccount.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  domains: many(organizationDomain),
  members: many(organizationMember),
  verificationRequests: many(organizationVerificationRequest),
}));

export const organizationDomainRelations = relations(organizationDomain, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationDomain.organizationId],
    references: [organization.id],
  }),
}));

export const organizationMemberRelations = relations(organizationMember, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationMember.organizationId],
    references: [organization.id],
  }),
  user: one(userAccount, {
    fields: [organizationMember.userId],
    references: [userAccount.id],
  }),
}));

export const organizationVerificationRequestRelations = relations(
  organizationVerificationRequest,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [organizationVerificationRequest.organizationId],
      references: [organization.id],
    }),
    submittedBy: one(userAccount, {
      fields: [organizationVerificationRequest.submittedByUserId],
      references: [userAccount.id],
    }),
    reviewer: one(userAccount, {
      fields: [organizationVerificationRequest.reviewerUserId],
      references: [userAccount.id],
    }),
    documents: many(verificationDocument),
  }),
);

export const verificationDocumentRelations = relations(verificationDocument, ({ one }) => ({
  organizationVerificationRequest: one(organizationVerificationRequest, {
    fields: [verificationDocument.organizationVerificationRequestId],
    references: [organizationVerificationRequest.id],
  }),
  authorVerificationRequest: one(authorVerificationRequest, {
    fields: [verificationDocument.authorVerificationRequestId],
    references: [authorVerificationRequest.id],
  }),
}));

export const authorProfileRelations = relations(authorProfile, ({ one, many }) => ({
  user: one(userAccount, {
    fields: [authorProfile.userId],
    references: [userAccount.id],
  }),
  currentAffiliationOrg: one(organization, {
    fields: [authorProfile.currentAffiliationOrgId],
    references: [organization.id],
  }),
  verificationRequests: many(authorVerificationRequest),
}));

export const authorVerificationRequestRelations = relations(
  authorVerificationRequest,
  ({ one, many }) => ({
    author: one(authorProfile, {
      fields: [authorVerificationRequest.authorUserId],
      references: [authorProfile.userId],
    }),
    affiliationOrg: one(organization, {
      fields: [authorVerificationRequest.affiliationOrgId],
      references: [organization.id],
    }),
    reviewer: one(userAccount, {
      fields: [authorVerificationRequest.reviewerUserId],
      references: [userAccount.id],
    }),
    documents: many(verificationDocument),
  }),
);

export const resourceRelations = relations(resource, ({ one, many }) => ({
  ownerOrganization: one(organization, {
    fields: [resource.ownerOrganizationId],
    references: [organization.id],
  }),
  createdBy: one(userAccount, {
    fields: [resource.createdByUserId],
    references: [userAccount.id],
  }),
  versions: many(resourceVersion),
  paperMetadata: one(paperMetadata, {
    fields: [resource.id],
    references: [paperMetadata.resourceId],
  }),
  accessGrants: many(resourceAccessGrant),
}));

export const resourceVersionRelations = relations(resourceVersion, ({ one, many }) => ({
  resource: one(resource, {
    fields: [resourceVersion.resourceId],
    references: [resource.id],
  }),
  createdBy: one(userAccount, {
    fields: [resourceVersion.createdByUserId],
    references: [userAccount.id],
  }),
  ingestionJobs: many(resourceIngestionJob),
  chunks: many(resourceChunk),
  citations: many(citation),
  annotations: many(annotation),
}));

export const paperMetadataRelations = relations(paperMetadata, ({ one }) => ({
  resource: one(resource, {
    fields: [paperMetadata.resourceId],
    references: [resource.id],
  }),
}));

export const resourceIngestionJobRelations = relations(resourceIngestionJob, ({ one }) => ({
  resourceVersion: one(resourceVersion, {
    fields: [resourceIngestionJob.resourceVersionId],
    references: [resourceVersion.id],
  }),
}));

export const resourceChunkRelations = relations(resourceChunk, ({ one, many }) => ({
  resourceVersion: one(resourceVersion, {
    fields: [resourceChunk.resourceVersionId],
    references: [resourceVersion.id],
  }),
  citations: many(citation),
}));

export const citationRelations = relations(citation, ({ one }) => ({
  resourceVersion: one(resourceVersion, {
    fields: [citation.resourceVersionId],
    references: [resourceVersion.id],
  }),
  resourceChunk: one(resourceChunk, {
    fields: [citation.resourceChunkId],
    references: [resourceChunk.id],
  }),
  createdBy: one(userAccount, {
    fields: [citation.createdByUserId],
    references: [userAccount.id],
  }),
}));

export const annotationRelations = relations(annotation, ({ one, many }) => ({
  resourceVersion: one(resourceVersion, {
    fields: [annotation.resourceVersionId],
    references: [resourceVersion.id],
  }),
  createdBy: one(userAccount, {
    fields: [annotation.createdByUserId],
    references: [userAccount.id],
  }),
  revisions: many(annotationRevision),
}));

export const annotationRevisionRelations = relations(annotationRevision, ({ one }) => ({
  annotation: one(annotation, {
    fields: [annotationRevision.annotationId],
    references: [annotation.id],
  }),
  createdBy: one(userAccount, {
    fields: [annotationRevision.createdByUserId],
    references: [userAccount.id],
  }),
}));

export const resourceAccessGrantRelations = relations(resourceAccessGrant, ({ one }) => ({
  resource: one(resource, {
    fields: [resourceAccessGrant.resourceId],
    references: [resource.id],
  }),
  recipientOrganization: one(organization, {
    fields: [resourceAccessGrant.recipientOrganizationId],
    references: [organization.id],
  }),
  recipientUser: one(userAccount, {
    fields: [resourceAccessGrant.recipientUserId],
    references: [userAccount.id],
  }),
  grantedBy: one(userAccount, {
    fields: [resourceAccessGrant.grantedByUserId],
    references: [userAccount.id],
  }),
  revokedBy: one(userAccount, {
    fields: [resourceAccessGrant.revokedByUserId],
    references: [userAccount.id],
  }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  recipient: one(userAccount, {
    fields: [notification.recipientUserId],
    references: [userAccount.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(userAccount, {
    fields: [auditLog.actorUserId],
    references: [userAccount.id],
  }),
}));

export const idempotencyKeyRelations = relations(idempotencyKey, ({ one }) => ({
  user: one(userAccount, {
    fields: [idempotencyKey.userId],
    references: [userAccount.id],
  }),
}));

// outboxEvent has no FK relations — it references aggregates polymorphically by type/id.
export type OutboxEventRow = typeof outboxEvent.$inferSelect;
