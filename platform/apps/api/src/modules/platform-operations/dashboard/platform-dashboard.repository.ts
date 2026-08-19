import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

const WINDOW_SQL = sql`now() - interval '6 months'`;

/** Backs `GET /platform/dashboard-stats` — one `date_trunc('month', ...)` grouped count per
 * source table over the last 6 months, merged by month string in the service layer (same
 * shape as `OrganizationsRepository.statsForPlatform`). Kept as separate queries rather than
 * one big join: the source tables have no natural join key between them (a "new user" and a
 * "new case" in the same month aren't related rows), so a join would just be a cross product
 * the code then has to unpick — independent index-only COUNTs are simpler and cheaper. */
@Injectable()
export class PlatformDashboardRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  newUsersByMonth() {
    return this.db
      .select({ month: sql<string>`date_trunc('month', ${schema.userAccount.createdAt})::date`, count: sql<number>`count(*)::int` })
      .from(schema.userAccount)
      .where(gte(schema.userAccount.createdAt, WINDOW_SQL))
      .groupBy(sql`1`);
  }

  newOrganizationsByMonth() {
    return this.db
      .select({ month: sql<string>`date_trunc('month', ${schema.organization.createdAt})::date`, count: sql<number>`count(*)::int` })
      .from(schema.organization)
      .where(gte(schema.organization.createdAt, WINDOW_SQL))
      .groupBy(sql`1`);
  }

  newTechnologyCasesByMonth() {
    return this.db
      .select({ month: sql<string>`date_trunc('month', ${schema.technologyCase.createdAt})::date`, count: sql<number>`count(*)::int` })
      .from(schema.technologyCase)
      .where(gte(schema.technologyCase.createdAt, WINDOW_SQL))
      .groupBy(sql`1`);
  }

  newResourcesByMonth() {
    return this.db
      .select({ month: sql<string>`date_trunc('month', ${schema.resource.createdAt})::date`, count: sql<number>`count(*)::int` })
      .from(schema.resource)
      .where(gte(schema.resource.createdAt, WINDOW_SQL))
      .groupBy(sql`1`);
  }

  /** Decision date is `reviewedAt`, not `submittedAt` — a request can be submitted long
   * before it's decided, and the dashboard's approval-rate KPI is about reviewer output
   * (decisions made this month), not submission volume. Org + author verification decisions
   * combined into one series — the dashboard treats "verification review" as one KPI, not
   * two, same simplification `PlatformOpsDashboardBody` already makes for pending counts. */
  async verificationDecisionsByMonth(decision: "APPROVED" | "REJECTED") {
    const [orgRows, authorRows] = await Promise.all([
      this.db
        .select({
          month: sql<string>`date_trunc('month', ${schema.organizationVerificationRequest.reviewedAt})::date`,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.organizationVerificationRequest)
        .where(
          and(
            gte(schema.organizationVerificationRequest.reviewedAt, WINDOW_SQL),
            eq(schema.organizationVerificationRequest.status, decision),
          ),
        )
        .groupBy(sql`1`),
      this.db
        .select({
          month: sql<string>`date_trunc('month', ${schema.authorVerificationRequest.reviewedAt})::date`,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.authorVerificationRequest)
        .where(
          and(
            gte(schema.authorVerificationRequest.reviewedAt, WINDOW_SQL),
            eq(schema.authorVerificationRequest.status, decision),
          ),
        )
        .groupBy(sql`1`),
    ]);
    const merged = new Map<string, number>();
    for (const row of [...orgRows, ...authorRows]) {
      merged.set(row.month, (merged.get(row.month) ?? 0) + row.count);
    }
    return [...merged.entries()].map(([month, count]) => ({ month, count }));
  }
}
