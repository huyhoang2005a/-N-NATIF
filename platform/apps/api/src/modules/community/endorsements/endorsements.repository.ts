import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class EndorsementsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** `.onConflictDoNothing()` — same idempotent-insert pattern as `VotesRepository`/
   * `SavesRepository`/`FollowsRepository`; conflict target is the composite unique index
   * (`uq_expertise_endorsement_endorser_author_tag`). Tag-membership validation ("is this
   * currently one of the author's expertise tags") happens in the service layer, not
   * here — this repository only knows about the endorsement rows themselves. */
  async endorse(endorserUserId: string, authorUserId: string, tag: string): Promise<void> {
    await this.db
      .insert(schema.expertiseEndorsement)
      .values({ endorserUserId, authorUserId, tag })
      .onConflictDoNothing();
  }

  async unendorse(endorserUserId: string, authorUserId: string, tag: string): Promise<void> {
    await this.db
      .delete(schema.expertiseEndorsement)
      .where(
        and(
          eq(schema.expertiseEndorsement.endorserUserId, endorserUserId),
          eq(schema.expertiseEndorsement.authorUserId, authorUserId),
          eq(schema.expertiseEndorsement.tag, tag),
        ),
      );
  }

  /** Every tag of this author the given endorser has endorsed — used to answer "which of
   * this author's tags have I already endorsed" in one query instead of one per tag. */
  async listEndorsedTags(endorserUserId: string, authorUserId: string): Promise<Set<string>> {
    const rows = await this.db.query.expertiseEndorsement.findMany({
      where: and(eq(schema.expertiseEndorsement.endorserUserId, endorserUserId), eq(schema.expertiseEndorsement.authorUserId, authorUserId)),
    });
    return new Set(rows.map((r) => r.tag));
  }

  /** Batched per-tag counts for one author — avoids N+1 when rendering the full tag list
   * on the public profile, same shape as `VotesRepository.countVotesForResources`. */
  async countEndorsementsByTag(authorUserId: string, tags: string[]): Promise<Map<string, number>> {
    if (tags.length === 0) return new Map();
    const rows = await this.db
      .select({ tag: schema.expertiseEndorsement.tag, count: sql<number>`count(*)::int` })
      .from(schema.expertiseEndorsement)
      .where(and(eq(schema.expertiseEndorsement.authorUserId, authorUserId), inArray(schema.expertiseEndorsement.tag, tags)))
      .groupBy(schema.expertiseEndorsement.tag);
    return new Map(rows.map((r) => [r.tag, r.count]));
  }
}
