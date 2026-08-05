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

// Phase 2 (Author & Resource) — ported 1:1 from schema_v5_production.dbml.

export const authorVerificationStatusEnum = pgEnum("author_verification_status", [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "DECLINED",
  "SUSPENDED",
]);

export const resourceTypeEnum = pgEnum("resource_type", [
  "PAPER",
  "REPORT",
  "DATASET",
  "MODEL",
  "CHECKPOINT",
  "SOURCE_CODE",
  "PATENT",
  "LICENSE",
  "ARCHITECTURE_DOCUMENT",
  "EXPERIMENT_RESULT",
  "PILOT_EVIDENCE",
  "VIDEO",
  "OTHER",
]);

export const resourceStatusEnum = pgEnum("resource_status", [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
  "WITHDRAWN",
]);

export const resourceVersionStatusEnum = pgEnum("resource_version_status", [
  "DRAFT",
  "PUBLISHED",
  "SUPERSEDED",
  "WITHDRAWN",
]);

export const resourceAccessLevelEnum = pgEnum("resource_access_level", [
  "PUBLIC",
  "ORGANIZATION",
  "CASE_ONLY",
  "APPROVAL_REQUIRED",
  "PRIVATE",
]);

export const accessPermissionEnum = pgEnum("access_permission", [
  "VIEW",
  "DOWNLOAD",
  "MANAGE",
]);

export const accessGrantStatusEnum = pgEnum("access_grant_status", [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
]);

export const contentModerationStatusEnum = pgEnum("content_moderation_status", [
  "ACTIVE",
  "HIDDEN",
  "REMOVED",
]);

export const ingestionStatusEnum = pgEnum("ingestion_status", [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const annotationStatusEnum = pgEnum("annotation_status", [
  "ACTIVE",
  "DEPRECATED",
  "REMOVED",
]);

// Phase 3 (Technology Case & Evidence) — ported 1:1 from schema_v5_production.dbml.

export const technologyCaseStatusEnum = pgEnum("technology_case_status", [
  "DRAFT",
  "EVIDENCE_COLLECTION",
  "UNDER_ASSESSMENT",
  "GAP_IDENTIFIED",
  "ROADMAP_DRAFT",
  "ROADMAP_APPROVED",
  "PILOT_READY",
  "TRANSFER_READY",
  "COMMERCIALIZED",
  "ARCHIVED",
]);

export const caseOriginTypeEnum = pgEnum("case_origin_type", [
  "MANUAL",
  "DISCOVERY_RECOMMENDATION",
  "RESEARCH_PROPOSAL",
  "IMPORT",
]);

export const caseOrganizationRoleEnum = pgEnum("case_organization_role", [
  "OWNING_ORGANIZATION",
  "PARTNER_COMPANY",
  "REVIEW_ORGANIZATION",
  "SUPPORT_ORGANIZATION",
]);

export const caseMemberRoleEnum = pgEnum("case_member_role", [
  "OWNER",
  "TECHNICAL_MEMBER",
  "CASE_REVIEWER",
  "PARTNER_MEMBER",
  "VIEWER",
]);

export const evidenceStatusEnum = pgEnum("evidence_status", [
  "ACTIVE",
  "SUPERSEDED",
  "REJECTED",
]);

export const visibilityLevelEnum = pgEnum("visibility_level", [
  "PUBLIC",
  "ORGANIZATION_ONLY",
  "PARTNERS_ONLY",
  "PRIVATE",
]);
