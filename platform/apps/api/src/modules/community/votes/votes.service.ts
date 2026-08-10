import { Injectable } from "@nestjs/common";
import { VotesRepository } from "./votes.repository";

export interface VoteInfo {
  voteCount: number;
  votedByMe: boolean;
}

/** Community layer, đợt 1 (upvote). Target-agnostic — `resource` and `research_need` share
 * the same `content_vote` table (one-of-two-FK pattern, see `community.ts` schema comment),
 * so one service covers both instead of duplicating toggle/decorate logic per target type. */
@Injectable()
export class VotesService {
  constructor(private readonly repository: VotesRepository) {}

  voteResource(actorUserId: string, resourceId: string): Promise<void> {
    return this.repository.voteResource(actorUserId, resourceId);
  }

  unvoteResource(actorUserId: string, resourceId: string): Promise<void> {
    return this.repository.unvoteResource(actorUserId, resourceId);
  }

  voteResearchNeed(actorUserId: string, researchNeedId: string): Promise<void> {
    return this.repository.voteResearchNeed(actorUserId, researchNeedId);
  }

  unvoteResearchNeed(actorUserId: string, researchNeedId: string): Promise<void> {
    return this.repository.unvoteResearchNeed(actorUserId, researchNeedId);
  }

  sumVotesForResources(resourceIds: string[]): Promise<number> {
    return this.repository.sumVotesForResources(resourceIds);
  }

  async voteInfoForResource(actorUserId: string, resourceId: string): Promise<VoteInfo> {
    const map = await this.voteInfoForResources(actorUserId, [resourceId]);
    return map.get(resourceId)!;
  }

  async voteInfoForResources(actorUserId: string, resourceIds: string[]): Promise<Map<string, VoteInfo>> {
    const [counts, voted] = await Promise.all([
      this.repository.countVotesForResources(resourceIds),
      this.repository.votedResourceIds(actorUserId, resourceIds),
    ]);
    return new Map(resourceIds.map((id) => [id, { voteCount: counts.get(id) ?? 0, votedByMe: voted.has(id) }]));
  }

  async voteInfoForResearchNeed(actorUserId: string, researchNeedId: string): Promise<VoteInfo> {
    const map = await this.voteInfoForResearchNeeds(actorUserId, [researchNeedId]);
    return map.get(researchNeedId)!;
  }

  async voteInfoForResearchNeeds(actorUserId: string, researchNeedIds: string[]): Promise<Map<string, VoteInfo>> {
    const [counts, voted] = await Promise.all([
      this.repository.countVotesForResearchNeeds(researchNeedIds),
      this.repository.votedResearchNeedIds(actorUserId, researchNeedIds),
    ]);
    return new Map(researchNeedIds.map((id) => [id, { voteCount: counts.get(id) ?? 0, votedByMe: voted.has(id) }]));
  }
}
