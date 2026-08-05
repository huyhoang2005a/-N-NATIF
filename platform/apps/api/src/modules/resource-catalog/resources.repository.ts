import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class ResourcesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: typeof schema.resource.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.resource).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async findById(id: string) {
    return this.db.query.resource.findFirst({ where: eq(schema.resource.id, id) });
  }

  /** SUC-05 (ĐỀ XUẤT — CẦN REVIEW, xem plan B.0.1): full-text search + permission filter
   * applied BEFORE returning results — actor sees a resource if it is PUBLIC, owned by
   * one of their active organizations, or explicitly granted via `resource_access_grant`.
   * Two queries instead of one correlated subquery keeps the permission check readable
   * and avoids hand-rolling a raw SQL `IN (...)` list. */
  async listVisible(input: { q?: string; actorUserId: string; actorOrgIds: string[] }) {
    const { q, actorUserId, actorOrgIds } = input;

    const grants = await this.db.query.resourceAccessGrant.findMany({
      where: and(
        eq(schema.resourceAccessGrant.status, "ACTIVE"),
        or(
          eq(schema.resourceAccessGrant.recipientUserId, actorUserId),
          actorOrgIds.length > 0
            ? inArray(schema.resourceAccessGrant.recipientOrganizationId, actorOrgIds)
            : undefined,
        ),
      ),
    });
    const grantedResourceIds = [...new Set(grants.map((grant) => grant.resourceId))];

    const permissionCondition = or(
      eq(schema.resource.accessLevel, "PUBLIC"),
      actorOrgIds.length > 0 ? inArray(schema.resource.ownerOrganizationId, actorOrgIds) : undefined,
      grantedResourceIds.length > 0 ? inArray(schema.resource.id, grantedResourceIds) : undefined,
    );

    const trimmedQuery = q?.trim();
    const searchCondition = trimmedQuery
      ? sql`to_tsvector('simple', ${schema.resource.title} || ' ' || coalesce(${schema.resource.description}, '')) @@ plainto_tsquery('simple', ${trimmedQuery})`
      : undefined;

    return this.db.query.resource.findMany({
      where: searchCondition ? and(permissionCondition, searchCondition) : permissionCondition,
      orderBy: [desc(schema.resource.createdAt)],
      limit: 50,
    });
  }

  async updateStatus(id: string, expectedVersion: number, status: string) {
    const rows = await this.db
      .update(schema.resource)
      .set({ status: status as never })
      .where(and(eq(schema.resource.id, id), eq(schema.resource.version, expectedVersion)))
      .returning();
    return rows[0];
  }

  async createVersion(values: typeof schema.resourceVersion.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.resourceVersion).values(values).returning();
    return firstOrThrow(rows, "createVersion: insert returned no row");
  }

  async findVersionById(id: string) {
    return this.db.query.resourceVersion.findFirst({ where: eq(schema.resourceVersion.id, id) });
  }

  async findLatestVersionByResource(resourceId: string) {
    return this.db.query.resourceVersion.findFirst({
      where: eq(schema.resourceVersion.resourceId, resourceId),
      orderBy: [desc(schema.resourceVersion.versionNo)],
    });
  }

  async findPublishedVersionByResource(resourceId: string) {
    return this.db.query.resourceVersion.findFirst({
      where: and(
        eq(schema.resourceVersion.resourceId, resourceId),
        eq(schema.resourceVersion.status, "PUBLISHED"),
      ),
    });
  }

  async updateVersionStatus(
    id: string,
    status: string,
    tx: Database,
    extra?: { publishedAt?: Date },
  ) {
    const rows = await tx
      .update(schema.resourceVersion)
      .set({ status: status as never, ...extra })
      .where(eq(schema.resourceVersion.id, id))
      .returning();
    return rows[0];
  }

  async createPaperMetadata(values: typeof schema.paperMetadata.$inferInsert, tx: Database) {
    await tx.insert(schema.paperMetadata).values(values);
  }

  async createIngestionJob(resourceVersionId: string, tx: Database) {
    const rows = await tx
      .insert(schema.resourceIngestionJob)
      .values({ resourceVersionId, status: "QUEUED" })
      .returning();
    return firstOrThrow(rows, "createIngestionJob: insert returned no row");
  }

  async hasActiveGrantForActor(resourceId: string, actorUserId: string, actorOrgIds: string[]) {
    const grant = await this.db.query.resourceAccessGrant.findFirst({
      where: and(
        eq(schema.resourceAccessGrant.resourceId, resourceId),
        eq(schema.resourceAccessGrant.status, "ACTIVE"),
        or(
          eq(schema.resourceAccessGrant.recipientUserId, actorUserId),
          actorOrgIds.length > 0
            ? inArray(schema.resourceAccessGrant.recipientOrganizationId, actorOrgIds)
            : undefined,
        ),
      ),
    });
    return grant !== undefined;
  }
}
