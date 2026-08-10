import type { ActivityFeedItemResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Injectable } from "@nestjs/common";
import { FollowsService } from "../../community/follows/follows.service";
import { SavesService } from "../../community/saves/saves.service";
import { VotesService } from "../../community/votes/votes.service";
import { toResourceResponse } from "../../resource-catalog/resources.service";
import { ResourcesRepository } from "../../resource-catalog/resources.repository";
import { ResearchNeedsRepository } from "../research-needs/research-needs.repository";
import { toNeedResponse } from "../research-needs/research-needs.service";

const FEED_LIMIT = 30;

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
    const [resourceVotes, resourceSaved, needVotes, needSaved] = await Promise.all([
      this.votesService.voteInfoForResources(actor.userId, resourceIds),
      this.savesService.savedByMeForResources(actor.userId, resourceIds),
      this.votesService.voteInfoForResearchNeeds(actor.userId, needIds),
      this.savesService.savedByMeForResearchNeeds(actor.userId, needIds),
    ]);

    const resourceItems: ActivityFeedItemResponse[] = resourceRows.map((row) => ({
      type: "RESOURCE",
      occurredAt: row.createdAt.toISOString(),
      resource: toResourceResponse(row, resourceVotes.get(row.id)!, resourceSaved.get(row.id) ?? false),
    }));
    const needItems: ActivityFeedItemResponse[] = needRows.map((row) => ({
      type: "RESEARCH_NEED",
      occurredAt: (row.publishedAt ?? row.createdAt).toISOString(),
      researchNeed: toNeedResponse(row, needVotes.get(row.id)!, needSaved.get(row.id) ?? false),
    }));

    return [...resourceItems, ...needItems]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, FEED_LIMIT);
  }
}
