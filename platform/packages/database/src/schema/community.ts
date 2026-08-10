import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { organization } from "./organization";
import { researchNeed } from "./company-discovery";
import { resource } from "./resource";

/** Community & networking layer (Reddit-style discovery + LinkedIn-style network) — new
 * bounded context, not part of the locked spec. Đợt 1 (upvote) + Đợt 2 (save/bookmark) +
 * Đợt 3 (follow) + Đợt 6 (endorse) so far, same "không dồn" discipline as Phase 5.
 *
 * `resourceId`/`researchNeedId` mirror `case_origin`'s "exactly one FK non-null" pattern —
 * CHECK constraint + 2 partial unique indexes are hand-written in a manual migration
 * (`packages/database/manual-migrations/`), not declared here, matching how `case_origin`
 * itself is written (see `technology-case.ts`). */
export const contentVote = pgTable("content_vote", {
  id: uuid("id").primaryKey().defaultRandom(),
  voterUserId: uuid("voter_user_id")
    .notNull()
    .references(() => userAccount.id),
  resourceId: uuid("resource_id").references(() => resource.id),
  researchNeedId: uuid("research_need_id").references(() => researchNeed.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Đợt 2 — bookmark, same "exactly one FK non-null" shape as `content_vote` above, just a
 * different table (a resource/need can be both voted and saved independently). */
export const contentSave = pgTable("content_save", {
  id: uuid("id").primaryKey().defaultRandom(),
  saverUserId: uuid("saver_user_id")
    .notNull()
    .references(() => userAccount.id),
  resourceId: uuid("resource_id").references(() => resource.id),
  researchNeedId: uuid("research_need_id").references(() => researchNeed.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Đợt 3 — follow tác giả/tổ chức. Unlike `content_vote`/`content_save`, each of these 2
 * tables has exactly ONE target column (not "1-of-2 nullable"), so a plain composite
 * unique index declared right here is correct — no partial-index/CHECK trick needed, same
 * pattern as `uq_organization_member_org_user` in `organization.ts`. */
export const authorFollow = pgTable(
  "author_follow",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerUserId: uuid("follower_user_id")
      .notNull()
      .references(() => userAccount.id),
    followedAuthorUserId: uuid("followed_author_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uqFollowerAuthor: uniqueIndex("uq_author_follow_follower_author").on(table.followerUserId, table.followedAuthorUserId),
  }),
);

export const organizationFollow = pgTable(
  "organization_follow",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerUserId: uuid("follower_user_id")
      .notNull()
      .references(() => userAccount.id),
    followedOrganizationId: uuid("followed_organization_id")
      .notNull()
      .references(() => organization.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uqFollowerOrg: uniqueIndex("uq_organization_follow_follower_org").on(table.followerUserId, table.followedOrganizationId),
  }),
);

/** Đợt 6 — endorse kỹ năng. `tag` is a free-text string, not an FK — `author_profile.
 * expertise_tags` is itself a free `text[]` column with no lookup table (see that
 * column's own comment in `author.ts`), so there is nothing to reference; "is this tag
 * currently one of the author's expertise tags" is a service-layer check against that
 * array at endorse-time, not a DB constraint. */
export const expertiseEndorsement = pgTable(
  "expertise_endorsement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endorserUserId: uuid("endorser_user_id")
      .notNull()
      .references(() => userAccount.id),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => userAccount.id),
    tag: varchar("tag", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uqEndorserAuthorTag: uniqueIndex("uq_expertise_endorsement_endorser_author_tag").on(
      table.endorserUserId,
      table.authorUserId,
      table.tag,
    ),
  }),
);
