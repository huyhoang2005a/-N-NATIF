import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class FollowsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** `.onConflictDoNothing()` — same idempotent-insert pattern as `VotesRepository`/
   * `SavesRepository`; here the target of the conflict is the plain composite unique
   * index (`uq_author_follow_follower_author` / `uq_organization_follow_follower_org`)
   * declared directly on the table, not a partial index, since each table has exactly one
   * target column. Returns whether a row was actually inserted (vs. an already-following
   * no-op) — the service layer only fires the `AuthorFollowed` outbox event, and thus only
   * ever notifies the followed author once, on a genuinely NEW follow. */
  async followAuthor(followerUserId: string, followedAuthorUserId: string): Promise<boolean> {
    const inserted = await this.db
      .insert(schema.authorFollow)
      .values({ followerUserId, followedAuthorUserId })
      .onConflictDoNothing()
      .returning({ id: schema.authorFollow.id });
    return inserted.length > 0;
  }

  async unfollowAuthor(followerUserId: string, followedAuthorUserId: string): Promise<void> {
    await this.db
      .delete(schema.authorFollow)
      .where(and(eq(schema.authorFollow.followerUserId, followerUserId), eq(schema.authorFollow.followedAuthorUserId, followedAuthorUserId)));
  }

  async isFollowingAuthor(followerUserId: string, followedAuthorUserId: string): Promise<boolean> {
    const row = await this.db.query.authorFollow.findFirst({
      where: and(eq(schema.authorFollow.followerUserId, followerUserId), eq(schema.authorFollow.followedAuthorUserId, followedAuthorUserId)),
    });
    return row !== undefined;
  }

  async countAuthorFollowers(followedAuthorUserId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.authorFollow)
      .where(eq(schema.authorFollow.followedAuthorUserId, followedAuthorUserId));
    return row?.count ?? 0;
  }

  /** Đợt 4 (activity feed) — every author this user follows, no cap: feeds off of it via
   * a separately-capped feed query, not this list itself. */
  async listFollowedAuthorIds(followerUserId: string): Promise<string[]> {
    const rows = await this.db.query.authorFollow.findMany({
      where: eq(schema.authorFollow.followerUserId, followerUserId),
    });
    return rows.map((r) => r.followedAuthorUserId);
  }

  /** Returns whether a row was actually inserted — same "notify only on genuinely new
   * follow" reasoning as `followAuthor` above. */
  async followOrganization(followerUserId: string, followedOrganizationId: string): Promise<boolean> {
    const inserted = await this.db
      .insert(schema.organizationFollow)
      .values({ followerUserId, followedOrganizationId })
      .onConflictDoNothing()
      .returning({ id: schema.organizationFollow.id });
    return inserted.length > 0;
  }

  async unfollowOrganization(followerUserId: string, followedOrganizationId: string): Promise<void> {
    await this.db
      .delete(schema.organizationFollow)
      .where(
        and(
          eq(schema.organizationFollow.followerUserId, followerUserId),
          eq(schema.organizationFollow.followedOrganizationId, followedOrganizationId),
        ),
      );
  }

  async isFollowingOrganization(followerUserId: string, followedOrganizationId: string): Promise<boolean> {
    const row = await this.db.query.organizationFollow.findFirst({
      where: and(
        eq(schema.organizationFollow.followerUserId, followerUserId),
        eq(schema.organizationFollow.followedOrganizationId, followedOrganizationId),
      ),
    });
    return row !== undefined;
  }

  async countOrganizationFollowers(followedOrganizationId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.organizationFollow)
      .where(eq(schema.organizationFollow.followedOrganizationId, followedOrganizationId));
    return row?.count ?? 0;
  }

  /** Đợt 4 (activity feed) — every organization this user follows. */
  async listFollowedOrganizationIds(followerUserId: string): Promise<string[]> {
    const rows = await this.db.query.organizationFollow.findMany({
      where: eq(schema.organizationFollow.followerUserId, followerUserId),
    });
    return rows.map((r) => r.followedOrganizationId);
  }
}
