import { bigint, boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { organizationVerificationRequest } from "./organization";
import { authorVerificationRequest } from "./author";
import { verificationDocumentTypeEnum } from "./enums";

/**
 * Shared by both verification workflows (organization and author). Exactly one of the
 * two request FKs must be non-null — enforced by `chk_verification_document_exactly_one_request`
 * in manual-migrations/0003_phase2_resource_constraints.sql (Drizzle has no cross-column
 * CHECK builder). Both FKs are nullable at the schema level for that reason.
 */
export const verificationDocument = pgTable(
  "verification_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationVerificationRequestId: uuid("organization_verification_request_id").references(
      () => organizationVerificationRequest.id,
    ),
    authorVerificationRequestId: uuid("author_verification_request_id").references(
      () => authorVerificationRequest.id,
    ),
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
    index("idx_verification_document_author_request").on(table.authorVerificationRequestId),
  ],
);
