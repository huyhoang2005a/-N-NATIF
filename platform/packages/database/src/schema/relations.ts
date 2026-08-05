import { relations } from "drizzle-orm";
import { userAccount, userIdentity, userProfile } from "./identity";
import { organization, organizationDomain, organizationMember, organizationVerificationRequest } from "./organization";
import { verificationDocument } from "./verification";
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
