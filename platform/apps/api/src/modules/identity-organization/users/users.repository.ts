import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, inArray } from "drizzle-orm";
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
