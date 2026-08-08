import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class CompanyProfileRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByOrganizationId(organizationId: string) {
    return this.db.query.companyProfile.findFirst({
      where: eq(schema.companyProfile.organizationId, organizationId),
    });
  }

  async findBySlug(slug: string) {
    return this.db.query.companyProfile.findFirst({
      where: eq(schema.companyProfile.publicSlug, slug),
    });
  }

  async create(values: typeof schema.companyProfile.$inferInsert) {
    const [row] = await this.db.insert(schema.companyProfile).values(values).returning();
    if (!row) throw new Error("create: insert returned no row");
    return row;
  }

  async update(organizationId: string, updates: Partial<typeof schema.companyProfile.$inferInsert>) {
    const [row] = await this.db
      .update(schema.companyProfile)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.companyProfile.organizationId, organizationId))
      .returning();
    return row;
  }
}
