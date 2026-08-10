import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { researchNeed } from "./company-discovery";
import { resource } from "./resource";

/** Community & networking layer (Reddit-style discovery + LinkedIn-style network) — new
 * bounded context, not part of the locked spec. Đợt 1 (upvote) + Đợt 2 (save/bookmark) so
 * far; `author_follow` / `organization_follow` / `expertise_endorsement` tables land in
 * later batches per the approved plan, same "không dồn" discipline as Phase 5.
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
