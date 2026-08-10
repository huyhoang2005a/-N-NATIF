import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class TransferManifestRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: typeof schema.transferManifest.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.transferManifest).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async findById(id: string) {
    return this.db.query.transferManifest.findFirst({ where: eq(schema.transferManifest.id, id) });
  }

  async listByCase(technologyCaseId: string) {
    return this.db.query.transferManifest.findMany({
      where: eq(schema.transferManifest.technologyCaseId, technologyCaseId),
      orderBy: [desc(schema.transferManifest.versionNo)],
    });
  }

  async findLatestVersionByCase(technologyCaseId: string) {
    return this.db.query.transferManifest.findFirst({
      where: eq(schema.transferManifest.technologyCaseId, technologyCaseId),
      orderBy: [desc(schema.transferManifest.versionNo)],
    });
  }

  /** Optimistic lock — mirrors `RoadmapRepository.updateStatus`: WHERE id+version,
   * `updated_at`/`version` bumped by `set_updated_at_and_version()` DB trigger. */
  async update(
    id: string,
    expectedVersion: number,
    values: Partial<typeof schema.transferManifest.$inferInsert>,
    tx: Database,
  ) {
    const rows = await tx
      .update(schema.transferManifest)
      .set(values)
      .where(and(eq(schema.transferManifest.id, id), eq(schema.transferManifest.version, expectedVersion)))
      .returning();
    return rows[0];
  }

  async addItem(values: typeof schema.transferManifestItem.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.transferManifestItem).values(values).returning();
    return firstOrThrow(rows, "addItem: insert returned no row");
  }

  async listItems(transferManifestId: string) {
    return this.db.query.transferManifestItem.findMany({
      where: eq(schema.transferManifestItem.transferManifestId, transferManifestId),
      orderBy: [schema.transferManifestItem.createdAt],
    });
  }

  async addRecipient(values: typeof schema.transferRecipient.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.transferRecipient).values(values).returning();
    return firstOrThrow(rows, "addRecipient: insert returned no row");
  }

  async listRecipients(transferManifestId: string) {
    return this.db.query.transferRecipient.findMany({
      where: eq(schema.transferRecipient.transferManifestId, transferManifestId),
      orderBy: [schema.transferRecipient.createdAt],
    });
  }

  /** Cần cho snapshot metadata/location khi thêm item (UC-TRF-01) — không qua
   * `ResourcesRepository` (module khác) vì đây chỉ là 1 lookup đơn giản không cần business
   * logic, đúng tiền lệ `PublicProfilesRepository` đọc thẳng `schema.resource`. */
  async findResourceVersionById(id: string) {
    return this.db.query.resourceVersion.findFirst({ where: eq(schema.resourceVersion.id, id) });
  }
}
