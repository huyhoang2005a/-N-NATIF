import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

@Injectable()
export class AssessmentFrameworkRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string) {
    return this.db.query.assessmentFramework.findFirst({ where: eq(schema.assessmentFramework.id, id) });
  }

  /** UC-ASM-01: "Framework version" mặc định khi actor không truyền `frameworkId` —
   * framework mới nhất đang `ACTIVE` (§9.6: "Framework/criterion có version và
   * immutable sau khi được dùng"). */
  async findActiveFramework() {
    return this.db.query.assessmentFramework.findFirst({
      where: eq(schema.assessmentFramework.status, "ACTIVE"),
      orderBy: [desc(schema.assessmentFramework.versionNo)],
    });
  }

  async findCriteriaByFramework(frameworkId: string) {
    return this.db.query.assessmentCriterion.findMany({
      where: eq(schema.assessmentCriterion.frameworkId, frameworkId),
    });
  }

  async findCriterionById(id: string) {
    return this.db.query.assessmentCriterion.findFirst({ where: eq(schema.assessmentCriterion.id, id) });
  }
}
