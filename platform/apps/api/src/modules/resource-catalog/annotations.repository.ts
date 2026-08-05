import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class AnnotationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string) {
    return this.db.query.annotation.findFirst({ where: eq(schema.annotation.id, id) });
  }

  async findRevision(annotationId: string, revisionNo: number) {
    return this.db.query.annotationRevision.findFirst({
      where: and(
        eq(schema.annotationRevision.annotationId, annotationId),
        eq(schema.annotationRevision.revisionNo, revisionNo),
      ),
    });
  }

  async create(values: typeof schema.annotation.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.annotation).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async createRevision(values: typeof schema.annotationRevision.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.annotationRevision).values(values).returning();
    return firstOrThrow(rows, "createRevision: insert returned no row");
  }

  async bumpLatestRevision(id: string, latestRevisionNo: number, tx: Database) {
    const rows = await tx
      .update(schema.annotation)
      .set({ latestRevisionNo })
      .where(eq(schema.annotation.id, id))
      .returning();
    return firstOrThrow(rows, "bumpLatestRevision: update matched no row");
  }

  async remove(id: string, tx: Database) {
    const rows = await tx
      .update(schema.annotation)
      .set({ status: "REMOVED", deletedAt: new Date() })
      .where(eq(schema.annotation.id, id))
      .returning();
    return firstOrThrow(rows, "remove: update matched no row");
  }
}
