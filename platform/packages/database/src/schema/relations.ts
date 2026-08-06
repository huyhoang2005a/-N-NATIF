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
import {
  caseMember,
  caseOrganization,
  caseOrigin,
  caseStatusHistory,
  evidence,
  evidenceCitation,
  technologyCase,
  technologyProfile,
} from "./technology-case";
import {
  assessmentCriterion,
  assessmentFramework,
  assessmentScore,
  assessmentScoreCitation,
  assessmentScoreEvidence,
  gapCitation,
  gapEvidence,
  gapRecord,
  readinessAssessment,
} from "./assessment-gap";
import {
  milestoneDependency,
  milestoneGap,
  roadmap,
  roadmapMilestone,
  roadmapReview,
  roadmapTask,
} from "./roadmap";
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

export const technologyCaseRelations = relations(technologyCase, ({ one, many }) => ({
  owningOrganization: one(organization, {
    fields: [technologyCase.owningOrganizationId],
    references: [organization.id],
  }),
  createdBy: one(userAccount, {
    fields: [technologyCase.createdByUserId],
    references: [userAccount.id],
  }),
  origin: one(caseOrigin, {
    fields: [technologyCase.id],
    references: [caseOrigin.technologyCaseId],
  }),
  profile: one(technologyProfile, {
    fields: [technologyCase.id],
    references: [technologyProfile.technologyCaseId],
  }),
  organizations: many(caseOrganization),
  members: many(caseMember),
  statusHistory: many(caseStatusHistory),
  evidence: many(evidence),
}));

export const caseOriginRelations = relations(caseOrigin, ({ one }) => ({
  technologyCase: one(technologyCase, {
    fields: [caseOrigin.technologyCaseId],
    references: [technologyCase.id],
  }),
}));

export const technologyProfileRelations = relations(technologyProfile, ({ one }) => ({
  technologyCase: one(technologyCase, {
    fields: [technologyProfile.technologyCaseId],
    references: [technologyCase.id],
  }),
  updatedBy: one(userAccount, {
    fields: [technologyProfile.updatedByUserId],
    references: [userAccount.id],
  }),
}));

export const caseOrganizationRelations = relations(caseOrganization, ({ one }) => ({
  technologyCase: one(technologyCase, {
    fields: [caseOrganization.technologyCaseId],
    references: [technologyCase.id],
  }),
  organization: one(organization, {
    fields: [caseOrganization.organizationId],
    references: [organization.id],
  }),
}));

export const caseMemberRelations = relations(caseMember, ({ one }) => ({
  technologyCase: one(technologyCase, {
    fields: [caseMember.technologyCaseId],
    references: [technologyCase.id],
  }),
  user: one(userAccount, {
    fields: [caseMember.userId],
    references: [userAccount.id],
  }),
  organization: one(organization, {
    fields: [caseMember.organizationId],
    references: [organization.id],
  }),
  invitedBy: one(userAccount, {
    fields: [caseMember.invitedByUserId],
    references: [userAccount.id],
  }),
}));

export const caseStatusHistoryRelations = relations(caseStatusHistory, ({ one }) => ({
  technologyCase: one(technologyCase, {
    fields: [caseStatusHistory.technologyCaseId],
    references: [technologyCase.id],
  }),
  changedBy: one(userAccount, {
    fields: [caseStatusHistory.changedByUserId],
    references: [userAccount.id],
  }),
}));

export const evidenceRelations = relations(evidence, ({ one, many }) => ({
  technologyCase: one(technologyCase, {
    fields: [evidence.technologyCaseId],
    references: [technologyCase.id],
  }),
  resourceVersion: one(resourceVersion, {
    fields: [evidence.resourceVersionId],
    references: [resourceVersion.id],
  }),
  annotation: one(annotation, {
    fields: [evidence.annotationId],
    references: [annotation.id],
  }),
  createdBy: one(userAccount, {
    fields: [evidence.createdByUserId],
    references: [userAccount.id],
  }),
  citations: many(evidenceCitation),
}));

export const evidenceCitationRelations = relations(evidenceCitation, ({ one }) => ({
  evidence: one(evidence, {
    fields: [evidenceCitation.evidenceId],
    references: [evidence.id],
  }),
  citation: one(citation, {
    fields: [evidenceCitation.citationId],
    references: [citation.id],
  }),
}));

export const assessmentFrameworkRelations = relations(assessmentFramework, ({ one, many }) => ({
  createdBy: one(userAccount, {
    fields: [assessmentFramework.createdByUserId],
    references: [userAccount.id],
  }),
  criteria: many(assessmentCriterion),
  assessments: many(readinessAssessment),
}));

export const assessmentCriterionRelations = relations(assessmentCriterion, ({ one, many }) => ({
  framework: one(assessmentFramework, {
    fields: [assessmentCriterion.frameworkId],
    references: [assessmentFramework.id],
  }),
  scores: many(assessmentScore),
}));

export const readinessAssessmentRelations = relations(readinessAssessment, ({ one, many }) => ({
  technologyCase: one(technologyCase, {
    fields: [readinessAssessment.technologyCaseId],
    references: [technologyCase.id],
  }),
  framework: one(assessmentFramework, {
    fields: [readinessAssessment.frameworkId],
    references: [assessmentFramework.id],
  }),
  createdBy: one(userAccount, {
    fields: [readinessAssessment.createdByUserId],
    references: [userAccount.id],
  }),
  submittedBy: one(userAccount, {
    fields: [readinessAssessment.submittedByUserId],
    references: [userAccount.id],
  }),
  approvedBy: one(userAccount, {
    fields: [readinessAssessment.approvedByUserId],
    references: [userAccount.id],
  }),
  scores: many(assessmentScore),
  gaps: many(gapRecord),
}));

export const assessmentScoreRelations = relations(assessmentScore, ({ one, many }) => ({
  assessment: one(readinessAssessment, {
    fields: [assessmentScore.assessmentId],
    references: [readinessAssessment.id],
  }),
  criterion: one(assessmentCriterion, {
    fields: [assessmentScore.criterionId],
    references: [assessmentCriterion.id],
  }),
  createdBy: one(userAccount, {
    fields: [assessmentScore.createdByUserId],
    references: [userAccount.id],
  }),
  updatedBy: one(userAccount, {
    fields: [assessmentScore.updatedByUserId],
    references: [userAccount.id],
  }),
  evidenceLinks: many(assessmentScoreEvidence),
  citationLinks: many(assessmentScoreCitation),
}));

export const assessmentScoreEvidenceRelations = relations(assessmentScoreEvidence, ({ one }) => ({
  assessmentScore: one(assessmentScore, {
    fields: [assessmentScoreEvidence.assessmentScoreId],
    references: [assessmentScore.id],
  }),
  evidence: one(evidence, {
    fields: [assessmentScoreEvidence.evidenceId],
    references: [evidence.id],
  }),
}));

export const assessmentScoreCitationRelations = relations(assessmentScoreCitation, ({ one }) => ({
  assessmentScore: one(assessmentScore, {
    fields: [assessmentScoreCitation.assessmentScoreId],
    references: [assessmentScore.id],
  }),
  citation: one(citation, {
    fields: [assessmentScoreCitation.citationId],
    references: [citation.id],
  }),
}));

export const gapRecordRelations = relations(gapRecord, ({ one, many }) => ({
  technologyCase: one(technologyCase, {
    fields: [gapRecord.technologyCaseId],
    references: [technologyCase.id],
  }),
  sourceAssessment: one(readinessAssessment, {
    fields: [gapRecord.sourceAssessmentId],
    references: [readinessAssessment.id],
  }),
  sourceAssessmentScore: one(assessmentScore, {
    fields: [gapRecord.sourceAssessmentScoreId],
    references: [assessmentScore.id],
  }),
  owner: one(userAccount, {
    fields: [gapRecord.ownerUserId],
    references: [userAccount.id],
  }),
  createdBy: one(userAccount, {
    fields: [gapRecord.createdByUserId],
    references: [userAccount.id],
  }),
  resolvedBy: one(userAccount, {
    fields: [gapRecord.resolvedByUserId],
    references: [userAccount.id],
  }),
  evidenceLinks: many(gapEvidence),
  citationLinks: many(gapCitation),
  milestoneLinks: many(milestoneGap),
}));

export const gapEvidenceRelations = relations(gapEvidence, ({ one }) => ({
  gap: one(gapRecord, {
    fields: [gapEvidence.gapRecordId],
    references: [gapRecord.id],
  }),
  evidence: one(evidence, {
    fields: [gapEvidence.evidenceId],
    references: [evidence.id],
  }),
}));

export const gapCitationRelations = relations(gapCitation, ({ one }) => ({
  gap: one(gapRecord, {
    fields: [gapCitation.gapRecordId],
    references: [gapRecord.id],
  }),
  citation: one(citation, {
    fields: [gapCitation.citationId],
    references: [citation.id],
  }),
}));

export const roadmapRelations = relations(roadmap, ({ one, many }) => ({
  technologyCase: one(technologyCase, {
    fields: [roadmap.technologyCaseId],
    references: [technologyCase.id],
  }),
  createdBy: one(userAccount, {
    fields: [roadmap.createdByUserId],
    references: [userAccount.id],
  }),
  submittedBy: one(userAccount, {
    fields: [roadmap.submittedByUserId],
    references: [userAccount.id],
  }),
  approvedBy: one(userAccount, {
    fields: [roadmap.approvedByUserId],
    references: [userAccount.id],
  }),
  milestones: many(roadmapMilestone),
  reviews: many(roadmapReview),
}));

export const roadmapMilestoneRelations = relations(roadmapMilestone, ({ one, many }) => ({
  roadmap: one(roadmap, {
    fields: [roadmapMilestone.roadmapId],
    references: [roadmap.id],
  }),
  owner: one(userAccount, {
    fields: [roadmapMilestone.ownerUserId],
    references: [userAccount.id],
  }),
  tasks: many(roadmapTask),
  gapLinks: many(milestoneGap),
  predecessorDependencies: many(milestoneDependency, { relationName: "predecessorMilestone" }),
  successorDependencies: many(milestoneDependency, { relationName: "successorMilestone" }),
}));

export const roadmapTaskRelations = relations(roadmapTask, ({ one }) => ({
  milestone: one(roadmapMilestone, {
    fields: [roadmapTask.milestoneId],
    references: [roadmapMilestone.id],
  }),
  assignee: one(userAccount, {
    fields: [roadmapTask.assigneeUserId],
    references: [userAccount.id],
  }),
}));

export const milestoneDependencyRelations = relations(milestoneDependency, ({ one }) => ({
  predecessor: one(roadmapMilestone, {
    fields: [milestoneDependency.predecessorMilestoneId],
    references: [roadmapMilestone.id],
    relationName: "predecessorMilestone",
  }),
  successor: one(roadmapMilestone, {
    fields: [milestoneDependency.successorMilestoneId],
    references: [roadmapMilestone.id],
    relationName: "successorMilestone",
  }),
}));

export const milestoneGapRelations = relations(milestoneGap, ({ one }) => ({
  milestone: one(roadmapMilestone, {
    fields: [milestoneGap.milestoneId],
    references: [roadmapMilestone.id],
  }),
  gap: one(gapRecord, {
    fields: [milestoneGap.gapRecordId],
    references: [gapRecord.id],
  }),
}));

export const roadmapReviewRelations = relations(roadmapReview, ({ one }) => ({
  roadmap: one(roadmap, {
    fields: [roadmapReview.roadmapId],
    references: [roadmap.id],
  }),
  reviewer: one(userAccount, {
    fields: [roadmapReview.reviewerUserId],
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
