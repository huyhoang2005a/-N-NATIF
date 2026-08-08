import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { organization } from "./organization";
import { authorVerificationStatusEnum, verificationRequestStatusEnum } from "./enums";

/**
 * One-to-one with `user_account` — PK is the FK, same pattern as `user_profile`
 * (no `defaultRandom()`; a row only exists once a user starts author verification).
 */
export const authorProfile = pgTable("author_profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => userAccount.id),
  currentAffiliationOrgId: uuid("current_affiliation_org_id").references(() => organization.id),
  // Additive (Phase 5 Sprint 5.7): generated automatically when verificationStatus
  // transitions to VERIFIED (from display name + anti-collision suffix) — never
  // user-editable at first release. Nullable: unverified authors have no public profile.
  publicSlug: varchar("public_slug", { length: 160 }).unique(),
  orcid: varchar("orcid", { length: 50 }).unique(),
  bio: text("bio"),
  expertiseTags: text("expertise_tags").array(),
  verificationStatus: authorVerificationStatusEnum("verification_status")
    .notNull()
    .default("UNVERIFIED"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** UC-VER-01/02 — reuses `verificationRequestStatusEnum` (same PENDING/IN_REVIEW/
 * APPROVED/REJECTED/CANCELLED lifecycle as organization verification, see B.0). */
export const authorVerificationRequest = pgTable(
  "author_verification_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => authorProfile.userId),
    affiliationOrgId: uuid("affiliation_org_id")
      .notNull()
      .references(() => organization.id),
    status: verificationRequestStatusEnum("status").notNull().default("PENDING"),
    submittedNote: text("submitted_note"),
    reviewerUserId: uuid("reviewer_user_id").references(() => userAccount.id),
    reviewerNote: text("reviewer_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_author_verification_user_status").on(table.authorUserId, table.status),
    index("idx_author_verification_status_submitted").on(table.status, table.submittedAt),
  ],
);
