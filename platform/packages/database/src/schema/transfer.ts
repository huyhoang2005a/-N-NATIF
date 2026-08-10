import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { organization } from "./organization";
import { technologyCase } from "./technology-case";
import { resourceVersion } from "./resource";
import { accessPermissionEnum, transferManifestStatusEnum } from "./enums";

/** Phase 6 Sprint 6.1 — Transfer manifest never stores the original file, only metadata/
 * location snapshots (`transfer_manifest_item.location_url_snapshot`) — the real file stays
 * reachable only through `resource_access_grant` created at share time (see
 * `resource.ts`'s `resourceAccessGrant.sourceTransferManifestId`, added alongside this
 * file). `chk_transfer_recipient_exactly_one_target` CHECK + the "≥1 item and ≥1 recipient
 * before SHARED" business rule are hand-written in a manual migration / enforced in
 * `TransferManifestService` respectively — see that migration's header comment for why the
 * multi-condition rule isn't a DB trigger (same precedent as Phase 4 roadmap approval). */
export const transferManifest = pgTable(
  "transfer_manifest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyCaseId: uuid("technology_case_id")
      .notNull()
      .references(() => technologyCase.id),
    versionNo: integer("version_no").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    status: transferManifestStatusEnum("status").notNull().default("DRAFT"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [uniqueIndex("uq_transfer_manifest_case_version").on(table.technologyCaseId, table.versionNo)],
);

export const transferManifestItem = pgTable(
  "transfer_manifest_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transferManifestId: uuid("transfer_manifest_id")
      .notNull()
      .references(() => transferManifest.id),
    resourceVersionId: uuid("resource_version_id")
      .notNull()
      .references(() => resourceVersion.id),
    locationUrlSnapshot: text("location_url_snapshot").notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    permission: accessPermissionEnum("permission").notNull().default("VIEW"),
    metadataSnapshot: jsonb("metadata_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_transfer_manifest_item_manifest_version").on(table.transferManifestId, table.resourceVersionId)],
);

/** `recipientOrganizationId`/`recipientUserId` — exactly one non-null, CHECK added in the
 * manual migration (mirrors `resource_access_grant`'s identical pattern one table below). */
export const transferRecipient = pgTable("transfer_recipient", {
  id: uuid("id").primaryKey().defaultRandom(),
  transferManifestId: uuid("transfer_manifest_id")
    .notNull()
    .references(() => transferManifest.id),
  recipientOrganizationId: uuid("recipient_organization_id").references(() => organization.id),
  recipientUserId: uuid("recipient_user_id").references(() => userAccount.id),
  permission: accessPermissionEnum("permission").notNull().default("VIEW"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
