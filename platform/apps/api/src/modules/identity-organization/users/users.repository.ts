import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, gte, inArray, sql } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getProfile(userId: string) {
    return this.db.query.userProfile.findFirst({ where: eq(schema.userProfile.userId, userId) });
  }

  async findDisplayNames(userIds: string[]) {
    if (userIds.length === 0) return [];
    return this.db.query.userProfile.findMany({
      columns: { userId: true, displayName: true },
      where: inArray(schema.userProfile.userId, userIds),
    });
  }

  /** Not spec-mandated — explicit user-approved addition covering the frontend gap noted
   * in [[r2m_frontend_status]] ("no endpoint to list all users platform-wide"). Admin-only,
   * gated in the service layer. */
  async listAll(limit: number, offset: number) {
    return this.db.query.userAccount.findMany({
      with: { profile: true },
      orderBy: [desc(schema.userAccount.createdAt)],
      limit,
      offset,
    });
  }

  /** Not spec-mandated — explicit user-approved addition, admin suspend/reactivate
   * (2026-08-16). No optimistic-locking version column on `user_account` (unlike
   * `organization`) — the service layer's own current-status check is what guards
   * against a no-op/invalid transition, not a version conflict. */
  async updateStatus(userId: string, status: string) {
    const rows = await this.db.update(schema.userAccount).set({ status: status as never }).where(eq(schema.userAccount.id, userId)).returning();
    return rows[0];
  }

  /** Not spec-mandated — explicit user-approved addition for the admin user-detail page
   * (2026-08-16). */
  async findByIdForPlatform(userId: string) {
    return this.db.query.userAccount.findFirst({
      where: eq(schema.userAccount.id, userId),
      with: { profile: true },
    });
  }

  /** All statuses (not just ACTIVE) — an admin investigating a user needs the full
   * picture, unlike `OrganizationsRepository.listMembersForActiveOrganizations` (which
   * backs the user's own "my organizations" list). */
  async listOrganizationMemberships(userId: string) {
    return this.db.query.organizationMember.findMany({
      where: eq(schema.organizationMember.userId, userId),
      with: { organization: true },
    });
  }

  /** Not spec-mandated — explicit user-approved addition for the admin dashboard's growth
   * chart. Raw grouped rows only — the service layer zero-fills weeks/roles with no rows. */
  async statsForPlatform() {
    const weeklySignupRows = await this.db
      .select({
        weekStart: sql<string>`date_trunc('week', ${schema.userAccount.createdAt})::date`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.userAccount)
      .where(gte(schema.userAccount.createdAt, sql`now() - interval '12 weeks'`))
      .groupBy(sql`1`);

    const byRoleRows = await this.db
      .select({ role: schema.userAccount.platformRole, count: sql<number>`count(*)::int` })
      .from(schema.userAccount)
      .groupBy(schema.userAccount.platformRole);

    return { weeklySignupRows, byRoleRows };
  }

  async updateProfile(
    userId: string,
    updates: Partial<typeof schema.userProfile.$inferInsert>,
    tx?: Database,
  ) {
    const client = tx ?? this.db;
    const [updated] = await client
      .update(schema.userProfile)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userProfile.userId, userId))
      .returning();
    if (!updated) throw new Error("updateProfile: update matched no row");
    return updated;
  }
}
