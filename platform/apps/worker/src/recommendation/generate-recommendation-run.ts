import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { eq, sql } from "drizzle-orm";

const FOCUSED_TOP_N = 10;
const FEED_TOP_N = 20;
const MODEL_PROVIDER = "postgres-fts";
const MODEL_NAME = "ts_rank_cd";

interface RankedChunkRow {
  resource_version_id: string;
  resource_chunk_id: string;
  raw_score: number;
  snippet: string;
}

/** `queryText` is a whole concatenated need description (title/problem statement/field/
 * output type — dozens of words), not a short user-typed search box query. `plainto_tsquery`
 * ANDs every single word together, so against short chunk content it matches virtually
 * nothing (a chunk would have to contain literally every word in the need description).
 * Builds an OR'd tsquery instead — rank by how many/how well terms overlap, the standard
 * "search relevance" semantics `ts_rank_cd` is meant for, not an exact-match filter. */
function buildOrTsQuery(queryText: string): string {
  const terms = Array.from(
    new Set(
      queryText
        .split(/\s+/)
        .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
        .filter((word) => word.length > 1),
    ),
  );
  return terms.join(" | ");
}

/** Phase 5a (Sprint 5.4/5.5) — Postgres full-text search only, no LLM/embedding. Shared by
 * both `run_type`s (`06_phase5_full_design.md` §3 Sprint 5.5 item 17: "dùng lại nguyên logic
 * scoring của Sprint 5.4, chỉ khác query text đầu vào"). Runs synchronously inside the
 * outbox dispatcher's `handleEvent`, matching how every other async side-effect in this app
 * is processed — no separate queue/worker infra. */
export async function generateRecommendationRun(db: Database, recommendationRunId: string): Promise<void> {
  const run = await db.query.recommendationRun.findFirst({ where: eq(schema.recommendationRun.id, recommendationRunId) });
  if (!run) return;
  // Idempotency guard: an outbox retry re-delivering this event after a partial failure
  // must not reprocess a run that's already RUNNING/COMPLETED/FAILED.
  if (run.status !== "QUEUED") return;

  await db
    .update(schema.recommendationRun)
    .set({ status: "RUNNING", startedAt: new Date(), modelProvider: MODEL_PROVIDER, modelName: MODEL_NAME })
    .where(eq(schema.recommendationRun.id, recommendationRunId));

  try {
    if (run.runType === "FOCUSED") {
      await generateFocused(db, run);
    } else {
      await generateFeed(db, run);
    }
    await db
      .update(schema.recommendationRun)
      .set({ status: "COMPLETED", completedAt: new Date() })
      .where(eq(schema.recommendationRun.id, recommendationRunId));
  } catch (error) {
    await db
      .update(schema.recommendationRun)
      .set({
        status: "FAILED",
        completedAt: new Date(),
        errorCode: "RECOMMENDATION_RUN_FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(schema.recommendationRun.id, recommendationRunId));
  }
}

async function generateFocused(db: Database, run: typeof schema.recommendationRun.$inferSelect): Promise<number> {
  if (!run.researchNeedId || !run.needStatementVersionId) {
    throw new Error(`FOCUSED run ${run.id} missing researchNeedId/needStatementVersionId — data integrity violation.`);
  }
  const need = await db.query.researchNeed.findFirst({ where: eq(schema.researchNeed.id, run.researchNeedId) });
  const version = await db.query.needStatementVersion.findFirst({
    where: eq(schema.needStatementVersion.id, run.needStatementVersionId),
  });
  if (!need || !version) {
    throw new Error(`FOCUSED run ${run.id}: research need or statement version not found.`);
  }

  const queryText = `${version.problemStatement} ${version.technicalField} ${version.desiredOutputType}`;

  return scoreAndInsertItems(db, {
    recommendationRunId: run.id,
    requestedByUserId: run.requestedByUserId,
    queryText,
    companyOrganizationId: need.companyOrganizationId,
    topN: FOCUSED_TOP_N,
  });
}

/** §3 Sprint 5.5 item 17: same shared `scoreAndInsertItems`, only the query text and
 * `topN` differ from FOCUSED. `companyProfile.industryCode` is free-text (not a coded
 * enum in this schema), so there is no "map mã ngành → tên đầy đủ" lookup to do — it's
 * already human-readable, used as-is. */
async function generateFeed(db: Database, run: typeof schema.recommendationRun.$inferSelect): Promise<number> {
  if (!run.companyOrganizationId) {
    throw new Error(`FEED run ${run.id} missing companyOrganizationId — data integrity violation.`);
  }
  const profile = await db.query.companyProfile.findFirst({
    where: eq(schema.companyProfile.organizationId, run.companyOrganizationId),
  });
  if (!profile) {
    throw new Error(`FEED run ${run.id}: company profile not found for org ${run.companyOrganizationId}.`);
  }

  const queryText = [profile.industryCode, profile.description].filter(Boolean).join(" ");
  if (!queryText.trim()) {
    // Company profile has neither field filled in — nothing to score against, a run with
    // 0 items (not an error) is the correct, spec-anticipated outcome here.
    return 0;
  }

  return scoreAndInsertItems(db, {
    recommendationRunId: run.id,
    requestedByUserId: run.requestedByUserId,
    queryText,
    companyOrganizationId: run.companyOrganizationId,
    topN: FEED_TOP_N,
    excludeDismissedForFeedCompanyOrgId: run.companyOrganizationId,
  });
}

/** §3 Sprint 5.4 item 11-12: 1 best-scoring chunk per `resource_version` (`ROW_NUMBER() ...
 * PARTITION BY rv.id`), only `resource_version`s the company can read (`PUBLIC` OR an
 * ACTIVE `resource_access_grant` for `companyOrganizationId`), `raw_score = 0` excluded
 * entirely (never padded to hit a target count). `ts_headline`'s default `<b>...</b>`
 * match markup is stripped in JS after the query (an empty `StartSel=`/`StopSel=` in the
 * options string does not reliably produce plain output — verified against a live
 * Postgres instance) so the snippet is plain text, safe to render directly without
 * `dangerouslySetInnerHTML` on the frontend. */
async function scoreAndInsertItems(
  db: Database,
  params: {
    recommendationRunId: string;
    requestedByUserId: string;
    queryText: string;
    companyOrganizationId: string;
    topN: number;
    /** §3 Sprint 5.5 item 19: "Item từng dismiss trong 1 run FEED không hiện lại ở run FEED
     * sau của cùng công ty" — checked across the company's FEED run history, not just the
     * current run. FOCUSED runs never pass this. */
    excludeDismissedForFeedCompanyOrgId?: string;
  },
): Promise<number> {
  const tsQueryText = buildOrTsQuery(params.queryText);
  if (!tsQueryText) return 0;

  const dismissedExclusion = params.excludeDismissedForFeedCompanyOrgId
    ? sql`AND NOT EXISTS (
        SELECT 1 FROM recommendation_item ri2
        JOIN recommendation_run rr2 ON rr2.id = ri2.recommendation_run_id
        WHERE ri2.resource_version_id = rv.id
          AND ri2.status = 'DISMISSED'
          AND rr2.run_type = 'FEED'
          AND rr2.company_organization_id = ${params.excludeDismissedForFeedCompanyOrgId}
      )`
    : sql``;

  const result = await db.execute(sql`
    WITH ranked_chunks AS (
      SELECT
        rv.id AS resource_version_id,
        rc.id AS resource_chunk_id,
        ts_rank_cd(to_tsvector('simple', rc.content), to_tsquery('simple', ${tsQueryText})) AS raw_score,
        ts_headline(
          'simple', rc.content, to_tsquery('simple', ${tsQueryText}),
          'MaxFragments=1, MaxWords=40, MinWords=15'
        ) AS snippet,
        ROW_NUMBER() OVER (
          PARTITION BY rv.id
          ORDER BY ts_rank_cd(to_tsvector('simple', rc.content), to_tsquery('simple', ${tsQueryText})) DESC
        ) AS rn
      FROM resource_chunk rc
      JOIN resource_version rv ON rv.id = rc.resource_version_id AND rv.status = 'PUBLISHED'
      JOIN resource r ON r.id = rv.resource_id
        AND r.status = 'ACTIVE' AND r.moderation_status = 'ACTIVE' AND r.deleted_at IS NULL
      WHERE (
        r.access_level = 'PUBLIC'
        OR EXISTS (
          SELECT 1 FROM resource_access_grant g
          WHERE g.resource_id = r.id AND g.status = 'ACTIVE' AND g.recipient_organization_id = ${params.companyOrganizationId}
        )
      )
      ${dismissedExclusion}
    )
    SELECT resource_version_id, resource_chunk_id, raw_score::float8 AS raw_score, snippet
    FROM ranked_chunks
    WHERE rn = 1 AND raw_score > 0
    ORDER BY raw_score DESC
    LIMIT ${params.topN}
  `);

  const rows = (result.rows as unknown as RankedChunkRow[]).map((row) => ({
    ...row,
    snippet: row.snippet.replace(/<\/?b>/g, ""),
  }));
  if (rows.length === 0) return 0;

  const maxScore = rows[0]!.raw_score;
  const minScore = rows[rows.length - 1]!.raw_score;
  const scoreRange = maxScore - minScore;

  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const matchScore = scoreRange > 0 ? (row.raw_score - minScore) / scoreRange : 1;

      const [createdCitation] = await tx
        .insert(schema.citation)
        .values({
          resourceVersionId: row.resource_version_id,
          resourceChunkId: row.resource_chunk_id,
          snippet: row.snippet,
          createdByUserId: params.requestedByUserId,
        })
        .returning();
      if (!createdCitation) throw new Error("scoreAndInsertItems: citation insert returned no row");

      const [createdItem] = await tx
        .insert(schema.recommendationItem)
        .values({
          recommendationRunId: params.recommendationRunId,
          resourceVersionId: row.resource_version_id,
          rank: i + 1,
          matchScore: matchScore.toFixed(5),
          rationale: row.snippet,
        })
        .returning();
      if (!createdItem) throw new Error("scoreAndInsertItems: recommendation_item insert returned no row");

      await tx.insert(schema.recommendationCitation).values({
        recommendationItemId: createdItem.id,
        citationId: createdCitation.id,
      });
    }
  });

  return rows.length;
}
