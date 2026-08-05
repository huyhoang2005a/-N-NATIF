import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getProfile(userId: string) {
    return this.db.query.userProfile.findFirst({ where: eq(schema.userProfile.userId, userId) });
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
