import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { organization } from "./organization";
import { transferManifest } from "./transfer";
import { citext } from "./custom-types";
import {
  accessGrantStatusEnum,
  accessPermissionEnum,
  annotationStatusEnum,
  contentModerationStatusEnum,
  ingestionStatusEnum,
  resourceAccessLevelEnum,
  resourceStatusEnum,
  resourceTypeEnum,
  resourceVersionStatusEnum,
} from "./enums";

export const resource = pgTable(
  "resource",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerOrganizationId: uuid("owner_organization_id")
      .notNull()
      .references(() => organization.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    type: resourceTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    accessLevel: resourceAccessLevelEnum("access_level").notNull(),
    status: resourceStatusEnum("status").notNull().default("DRAFT"),
    moderationStatus: contentModerationStatusEnum("moderation_status")
      .notNull()
      .default("ACTIVE"),
    externalIdentifier: varchar("external_identifier", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_resource_owner_status").on(table.ownerOrganizationId, table.status),
    index("idx_resource_type_status").on(table.type, table.status),
    index("idx_resource_external_identifier").on(table.externalIdentifier),
  ],
);

export const resourceVersion = pgTable(
  "resource_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id),
    versionNo: integer("version_no").notNull(),
    versionLabel: varchar("version_label", { length: 100 }),
    sourceUrl: text("source_url"),
    storageObjectKey: text("storage_object_key"),
    contentHashSha256: varchar("content_hash_sha256", { length: 64 }),
    metadata: jsonb("metadata"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    status: resourceVersionStatusEnum("status").notNull().default("DRAFT"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Cache of the Gemini-generated Vietnamese summary of this version's extracted text
     * (`resource_chunk` rows) — generated once on first `POST .../summarize` call, reused
     * after. Null until generated (see manual migration 0013). */
    aiSummary: text("ai_summary"),
  },
  (table) => [
    uniqueIndex("uq_resource_version_resource_version_no").on(table.resourceId, table.versionNo),
    index("idx_resource_version_resource_status").on(table.resourceId, table.status),
    index("idx_resource_version_content_hash").on(table.contentHashSha256),
  ],
);

/** Subtype metadata for `resource.type = PAPER` only (UC-RES-01 acceptance criteria). */
export const paperMetadata = pgTable("paper_metadata", {
  resourceId: uuid("resource_id")
    .primaryKey()
    .references(() => resource.id),
  doi: citext("doi").unique(),
  abstract: text("abstract"),
  publisher: varchar("publisher", { length: 255 }),
  venue: varchar("venue", { length: 255 }),
  publicationDate: date("publication_date"),
  language: varchar("language", { length: 20 }),
});

export const resourceIngestionJob = pgTable(
  "resource_ingestion_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceVersionId: uuid("resource_version_id")
      .notNull()
      .references(() => resourceVersion.id),
    status: ingestionStatusEnum("status").notNull().default("QUEUED"),
    extractorVersion: varchar("extractor_version", { length: 100 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resource_ingestion_job_status_created").on(table.status, table.createdAt),
    index("idx_resource_ingestion_job_resource_version").on(table.resourceVersionId),
  ],
);

/** Populated by the ingestion worker (not built in Phase 2 — see B.0). Embedding stays
 * null until a real embedding pipeline exists; no HNSW index yet (see manual migration). */
export const resourceChunk = pgTable(
  "resource_chunk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceVersionId: uuid("resource_version_id")
      .notNull()
      .references(() => resourceVersion.id),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    sectionLabel: varchar("section_label", { length: 255 }),
    offsetStart: integer("offset_start"),
    offsetEnd: integer("offset_end"),
    tokenCount: integer("token_count"),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_resource_chunk_version_index").on(table.resourceVersionId, table.chunkIndex),
    index("idx_resource_chunk_resource_version").on(table.resourceVersionId),
  ],
);

/** Locator always resolves to a `resource_version` — never a bare `resource` (CLAUDE.md
 * rule 7: "Citation luôn trỏ tới resource_version"). */
export const citation = pgTable(
  "citation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceVersionId: uuid("resource_version_id")
      .notNull()
      .references(() => resourceVersion.id),
    resourceChunkId: uuid("resource_chunk_id").references(() => resourceChunk.id),
    snippet: text("snippet").notNull(),
    pageNumber: integer("page_number"),
    sectionLabel: varchar("section_label", { length: 255 }),
    offsetStart: integer("offset_start"),
    offsetEnd: integer("offset_end"),
    locatorMetadata: jsonb("locator_metadata"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_citation_resource_version").on(table.resourceVersionId),
    index("idx_citation_resource_chunk").on(table.resourceChunkId),
  ],
);

export const annotation = pgTable(
  "annotation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceVersionId: uuid("resource_version_id")
      .notNull()
      .references(() => resourceVersion.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    status: annotationStatusEnum("status").notNull().default("ACTIVE"),
    moderationStatus: contentModerationStatusEnum("moderation_status")
      .notNull()
      .default("ACTIVE"),
    latestRevisionNo: integer("latest_revision_no").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_annotation_resource_version_status").on(table.resourceVersionId, table.status),
    index("idx_annotation_created_by").on(table.createdByUserId),
  ],
);

/** Editing an annotation always inserts a new revision — the old row is never updated
 * (CLAUDE.md rule 6: Versioning; UC-RES-02 business invariant). */
export const annotationRevision = pgTable(
  "annotation_revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    annotationId: uuid("annotation_id")
      .notNull()
      .references(() => annotation.id),
    revisionNo: integer("revision_no").notNull(),
    content: text("content").notNull(),
    targetSnippet: text("target_snippet").notNull(),
    pageNumber: integer("page_number"),
    sectionLabel: varchar("section_label", { length: 255 }),
    offsetStart: integer("offset_start"),
    offsetEnd: integer("offset_end"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_annotation_revision_annotation_revision_no").on(
      table.annotationId,
      table.revisionNo,
    ),
  ],
);

/**
 * `source_transfer_manifest_id` — additive column, added now that Phase 6's `transfer_manifest`
 * exists (was intentionally omitted in Phase 2, see git history / earlier comment here). Set
 * when a grant was created by `TransferManifestService.share()`; null for grants created
 * directly via `POST /resources/:id/access-requests`.
 */
export const resourceAccessGrant = pgTable(
  "resource_access_grant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id),
    recipientOrganizationId: uuid("recipient_organization_id").references(() => organization.id),
    recipientUserId: uuid("recipient_user_id").references(() => userAccount.id),
    permission: accessPermissionEnum("permission").notNull(),
    status: accessGrantStatusEnum("status").notNull().default("ACTIVE"),
    grantedByUserId: uuid("granted_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    sourceTransferManifestId: uuid("source_transfer_manifest_id").references(() => transferManifest.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resource_access_grant_resource_status").on(table.resourceId, table.status),
    index("idx_resource_access_grant_recipient_org").on(table.recipientOrganizationId),
    index("idx_resource_access_grant_recipient_user").on(table.recipientUserId),
    index("idx_resource_access_grant_source_manifest").on(table.sourceTransferManifestId),
  ],
);
