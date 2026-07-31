import { bigint, boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { organizationVerificationRequest } from "./organization";
import { verificationDocumentTypeEnum } from "./enums";

/**
 * Phase 1 scope: only the Organization verification workflow is implemented, so this table
 * is wired to `organization_verification_request` only. The dbml's full shape also has a
 * nullable `author_verification_request_id` FK plus a "exactly one of the two is non-null"
 * check constraint — those are added in Phase 2 alongside `author_verification_request`
 * (additive migration, not an ALTER of existing business columns).
 */
export const verificationDocument = pgTable(
  "verification_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationVerificationRequestId: uuid("organization_verification_request_id")
      .notNull()
      .references(() => organizationVerificationRequest.id),
    documentType: verificationDocumentTypeEnum("document_type").notNull(),
    storageObjectKey: text("storage_object_key").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    encrypted: boolean("encrypted").notNull().default(true),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_verification_document_org_request").on(table.organizationVerificationRequestId),
  ],
);
