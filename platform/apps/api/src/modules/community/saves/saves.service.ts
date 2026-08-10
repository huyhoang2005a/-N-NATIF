import { Injectable } from "@nestjs/common";
import { SavesRepository } from "./saves.repository";

/** Community layer, đợt 2 (save/bookmark). Target-agnostic, same reasoning as
 * `VotesService`: `resource` and `research_need` share the `content_save` table. */
@Injectable()
export class SavesService {
  constructor(private readonly repository: SavesRepository) {}

  saveResource(actorUserId: string, resourceId: string): Promise<void> {
    return this.repository.saveResource(actorUserId, resourceId);
  }

  unsaveResource(actorUserId: string, resourceId: string): Promise<void> {
    return this.repository.unsaveResource(actorUserId, resourceId);
  }

  saveResearchNeed(actorUserId: string, researchNeedId: string): Promise<void> {
    return this.repository.saveResearchNeed(actorUserId, researchNeedId);
  }

  unsaveResearchNeed(actorUserId: string, researchNeedId: string): Promise<void> {
    return this.repository.unsaveResearchNeed(actorUserId, researchNeedId);
  }

  async savedByMeForResource(actorUserId: string, resourceId: string): Promise<boolean> {
    const map = await this.savedByMeForResources(actorUserId, [resourceId]);
    return map.get(resourceId) ?? false;
  }

  async savedByMeForResources(actorUserId: string, resourceIds: string[]): Promise<Map<string, boolean>> {
    const saved = await this.repository.savedResourceIds(actorUserId, resourceIds);
    return new Map(resourceIds.map((id) => [id, saved.has(id)]));
  }

  async savedByMeForResearchNeed(actorUserId: string, researchNeedId: string): Promise<boolean> {
    const map = await this.savedByMeForResearchNeeds(actorUserId, [researchNeedId]);
    return map.get(researchNeedId) ?? false;
  }

  async savedByMeForResearchNeeds(actorUserId: string, researchNeedIds: string[]): Promise<Map<string, boolean>> {
    const saved = await this.repository.savedResearchNeedIds(actorUserId, researchNeedIds);
    return new Map(researchNeedIds.map((id) => [id, saved.has(id)]));
  }

  listSavedResourceIds(actorUserId: string): Promise<{ resourceId: string; savedAt: Date }[]> {
    return this.repository.listSavedResourceIds(actorUserId);
  }

  listSavedResearchNeedIds(actorUserId: string): Promise<{ researchNeedId: string; savedAt: Date }[]> {
    return this.repository.listSavedResearchNeedIds(actorUserId);
  }
}
