import { Injectable } from "@nestjs/common";
import { EndorsementsRepository } from "./endorsements.repository";

/** Community layer, đợt 6 (endorse kỹ năng). Pure DB access, same one-way-dependency
 * reasoning as `VotesService`/`SavesService`/`FollowsService` — see `CommunityModule`. */
@Injectable()
export class EndorsementsService {
  constructor(private readonly repository: EndorsementsRepository) {}

  endorse(endorserUserId: string, authorUserId: string, tag: string): Promise<void> {
    return this.repository.endorse(endorserUserId, authorUserId, tag);
  }

  unendorse(endorserUserId: string, authorUserId: string, tag: string): Promise<void> {
    return this.repository.unendorse(endorserUserId, authorUserId, tag);
  }

  listEndorsedTags(endorserUserId: string, authorUserId: string): Promise<Set<string>> {
    return this.repository.listEndorsedTags(endorserUserId, authorUserId);
  }

  countEndorsementsByTag(authorUserId: string, tags: string[]): Promise<Map<string, number>> {
    return this.repository.countEndorsementsByTag(authorUserId, tags);
  }
}
