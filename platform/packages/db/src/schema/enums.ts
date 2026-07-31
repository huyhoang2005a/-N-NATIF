import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Enum names/values are ported 1:1 from docs/spec/schema_v5_production.dbml. Only the
 * enums needed by tables that exist in Phase 1 (Identity & Organization, Verification,
 * Platform Operations) are defined so far — later phases add the rest alongside their
 * bounded-context schema files, per CLAUDE.md "không nhảy cóc module".
 */

export const platformRoleEnum = pgEnum("platform_role", [
  "USER",
  "PLATFORM_REVIEWER",
  "PLATFORM_ADMIN",
]);

export const userStatusEnum = pgEnum("user_status", [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED",
]);

export const identityProviderEnum = pgEnum("identity_provider", [
  "LOCAL",
  "GOOGLE",
  "MICROSOFT",
  "ORCID",
  "SAML",
]);

export const organizationTypeEnum = pgEnum("organization_type", [
  "RESEARCH_UNIT",
  "ENTERPRISE",
  "GOVERNMENT",
  "SUPPORT_ORGANIZATION",
]);

export const organizationStatusEnum = pgEnum("organization_status", [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
  "ARCHIVED",
]);

export const organizationMemberRoleEnum = pgEnum("organization_member_role", [
  "ORG_OWNER",
  "ORG_ADMIN",
  "MEMBER",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "LEFT",
]);

export const verificationRequestStatusEnum = pgEnum("verification_request_status", [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const verificationDocumentTypeEnum = pgEnum("verification_document_type", [
  "IDENTITY_DOCUMENT",
  "AFFILIATION_PROOF",
  "ORGANIZATION_LETTER",
  "TAX_DOCUMENT",
  "OTHER",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "UNREAD",
  "READ",
  "ARCHIVED",
]);

export const outboxStatusEnum = pgEnum("outbox_status", [
  "PENDING",
  "PROCESSING",
  "PUBLISHED",
  "FAILED",
  "DEAD_LETTER",
]);
