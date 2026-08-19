import type { ActivityFeedAttribution, ActivityFeedItemResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { inArray } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";
import { S3Service } from "../../../common/storage/s3.service";
import { FollowsService } from "../../community/follows/follows.service";
import { SavesService } from "../../community/saves/saves.service";
import { VotesService } from "../../community/votes/votes.service";
import { toResourceResponse } from "../../resource-catalog/resources.service";
import { ResourcesRepository } from "../../resource-catalog/resources.repository";
import { ResearchNeedsRepository } from "../research-needs/research-needs.repository";
import { toNeedResponse } from "../research-needs/research-needs.service";

const FEED_LIMIT = 30;
const EMPTY_ATTRIBUTION: ActivityFeedAttribution = {
  authorName: null,
  authorSlug: null,
  avatarUrl: null,
  organizationName: null,
  organizationSlug: null,
};

/** `GET /activity-feed` (Cộng đồng đợt 4) — no new table, computed fresh on every read from
 * what the actor already follows (đợt 3). Design call not spelled out verbatim in the
 * plan: resources are attributed to followed AUTHORS (`createdByUserId`) OR followed
 * ORGANIZATIONS (`ownerOrganizationId`) — a resource can surface from either relationship —
 * while research needs only come from followed ORGANIZATIONS, since a need has no
 * individual-author concept anywhere else in this app. Reuses `toResourceResponse`/
 * `toNeedResponse` + batched vote/save lookups (same shape as `ResourcesService.list`) so
 * this stays O(1) extra queries regardless of feed size, unlike `SavedItemsService` (a
 * personal, usually-small list where per-item fetch was an acceptable simplification —
 * a feed is closer to a public listing, so the same N+1-avoidance applies here). */
@Injectable()
export class ActivityFeedService {
  constructor(
    private readonly followsService: FollowsService,
    private readonly resourcesRepository: ResourcesRepository,
    private readonly researchNeedsRepository: ResearchNeedsRepository,
    private readonly votesService: VotesService,
    private readonly savesService: SavesService,
    private readonly s3Service: S3Service,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async getFeed(actor: ActorContext): Promise<ActivityFeedItemResponse[]> {
    const [authorIds, organizationIds] = await Promise.all([
      this.followsService.listFollowedAuthorIds(actor.userId),
      this.followsService.listFollowedOrganizationIds(actor.userId),
    ]);

    if (authorIds.length === 0 && organizationIds.length === 0) return [];

    const [resourceRows, needRows] = await Promise.all([
      this.resourcesRepository.listRecentPublicForFeed({ authorIds, organizationIds, limit: FEED_LIMIT }),
      this.researchNeedsRepository.listRecentPublicOpenForOrganizations(organizationIds, FEED_LIMIT),
    ]);

    const resourceIds = resourceRows.map((r) => r.id);
    const needIds = needRows.map((n) => n.id);
    const [resourceVotes, resourceSaved, needVotes, needSaved, attributionByAuthor, attributionByOrg] =
      await Promise.all([
        this.votesService.voteInfoForResources(actor.userId, resourceIds),
        this.savesService.savedByMeForResources(actor.userId, resourceIds),
        this.votesService.voteInfoForResearchNeeds(actor.userId, needIds),
        this.savesService.savedByMeForResearchNeeds(actor.userId, needIds),
        this.loadAuthorAttribution(authorIds),
        this.loadOrganizationAttribution(organizationIds),
      ]);

    const resourceItems: ActivityFeedItemResponse[] = resourceRows.map((row) => ({
      type: "RESOURCE",
      occurredAt: row.createdAt.toISOString(),
      // A resource can match via either relationship (đợt 4 design call, see class doc) —
      // prefer the author byline when both are present, same as how a Facebook post shows
      // "Person, in Group" rather than just the group.
      attribution: attributionByAuthor.get(row.createdByUserId) ?? attributionByOrg.get(row.ownerOrganizationId) ?? EMPTY_ATTRIBUTION,
      summary: row.description,
      resource: toResourceResponse(row, resourceVotes.get(row.id)!, resourceSaved.get(row.id) ?? false),
    }));
    const needItems: ActivityFeedItemResponse[] = needRows.map((row) => ({
      type: "RESEARCH_NEED",
      occurredAt: (row.publishedAt ?? row.createdAt).toISOString(),
      attribution: attributionByOrg.get(row.companyOrganizationId) ?? EMPTY_ATTRIBUTION,
      summary: row.statementVersions[0]?.problemStatement ?? null,
      researchNeed: toNeedResponse(row, needVotes.get(row.id)!, needSaved.get(row.id) ?? false),
    }));

    return [...resourceItems, ...needItems]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, FEED_LIMIT);
  }

  /** Followed authors are always VERIFIED (only verified authors have a public profile to
   * follow via `/authors/:slug/follow`), so `publicSlug` is guaranteed non-null here —
   * bulk-fetched once per feed request, not per item, same N+1-avoidance as the vote/save
   * lookups above. Avatar presign resolution is deliberately deduped to one call per
   * distinct author (not per feed item), since the same followed author often posted more
   * than one item in the window. */
  private async loadAuthorAttribution(authorIds: string[]): Promise<Map<string, ActivityFeedAttribution>> {
    if (authorIds.length === 0) return new Map();
    const profiles = await this.db.query.authorProfile.findMany({
      where: inArray(schema.authorProfile.userId, authorIds),
      with: { user: { with: { profile: true } } },
    });
    const entries = await Promise.all(
      profiles.map(async (profile) => {
        const avatarKey = profile.user.profile?.avatarUrl ?? null;
        const avatarUrl = avatarKey ? (await this.s3Service.createResourceDownloadUrl(avatarKey)).url : null;
        const attribution: ActivityFeedAttribution = {
          authorName: profile.user.profile?.displayName ?? null,
          authorSlug: profile.publicSlug,
          avatarUrl,
          organizationName: null,
          organizationSlug: null,
        };
        return [profile.userId, attribution] as const;
      }),
    );
    return new Map(entries);
  }

  private async loadOrganizationAttribution(organizationIds: string[]): Promise<Map<string, ActivityFeedAttribution>> {
    if (organizationIds.length === 0) return new Map();
    const organizations = await this.db.query.organization.findMany({
      where: inArray(schema.organization.id, organizationIds),
    });
    return new Map(
      organizations.map((org) => [
        org.id,
        { authorName: null, authorSlug: null, avatarUrl: null, organizationName: org.name, organizationSlug: org.slug },
      ]),
    );
  }
}
