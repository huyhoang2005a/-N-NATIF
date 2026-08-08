import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class PublicProfilesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findVerifiedAuthorBySlug(slug: string) {
    return this.db.query.authorProfile.findFirst({
      where: and(eq(schema.authorProfile.publicSlug, slug), eq(schema.authorProfile.verificationStatus, "VERIFIED")),
      with: {
        currentAffiliationOrg: true,
      },
    });
  }

  async findUserProfile(userId: string) {
    return this.db.query.userProfile.findFirst({ where: eq(schema.userProfile.userId, userId) });
  }

  /** Rule 5.7: "resource có created_by_user_id = chính tác giả đó và access_level =
   * PUBLIC" — no other relation (co-author, org membership) counts. */
  async listPublicResourcesByAuthor(authorUserId: string) {
    return this.db.query.resource.findMany({
      where: and(
        eq(schema.resource.createdByUserId, authorUserId),
        eq(schema.resource.accessLevel, "PUBLIC"),
        eq(schema.resource.status, "ACTIVE"),
        eq(schema.resource.moderationStatus, "ACTIVE"),
      ),
      with: { paperMetadata: true },
    });
  }

  async findCompanyProfileBySlug(slug: string) {
    return this.db.query.companyProfile.findFirst({ where: eq(schema.companyProfile.publicSlug, slug) });
  }

  async findOrganizationBySlug(slug: string) {
    return this.db.query.organization.findFirst({ where: eq(schema.organization.slug, slug) });
  }

  async findOrganizationById(id: string) {
    return this.db.query.organization.findFirst({ where: eq(schema.organization.id, id) });
  }

  async listVerifiedAuthorsByOrganization(organizationId: string) {
    const profiles = await this.db.query.authorProfile.findMany({
      where: and(eq(schema.authorProfile.currentAffiliationOrgId, organizationId), eq(schema.authorProfile.verificationStatus, "VERIFIED")),
    });
    const withNames = await Promise.all(
      profiles.map(async (p) => ({ profile: p, userProfile: await this.findUserProfile(p.userId) })),
    );
    return withNames;
  }

  async listPublicResourcesByOrganization(organizationId: string) {
    return this.db.query.resource.findMany({
      where: and(
        eq(schema.resource.ownerOrganizationId, organizationId),
        eq(schema.resource.accessLevel, "PUBLIC"),
        eq(schema.resource.status, "ACTIVE"),
        eq(schema.resource.moderationStatus, "ACTIVE"),
      ),
      with: { paperMetadata: true },
    });
  }
}
