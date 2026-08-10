import type { SavedItemResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Injectable } from "@nestjs/common";
import { SavesService } from "../../community/saves/saves.service";
import { ResourcesService } from "../../resource-catalog/resources.service";
import { ResearchNeedsService } from "../research-needs/research-needs.service";

/** `GET /me/saved` (Cộng đồng đợt 2) — merges bookmarked resources + research needs into
 * one time-ordered list. Fetches each saved item through the owning service's normal
 * `getById` (same visibility/permission check as viewing it directly) rather than a
 * dedicated batch-read path — a personal bookmark list is small, so per-item fetch here is
 * a deliberate simplification, not the N+1 the public listing endpoints deliberately avoid
 * via batching. An item silently drops off the list if the actor has since lost access to
 * it (e.g. resource made PRIVATE) — the bookmark row itself is untouched, it just won't
 * render until access is restored. */
@Injectable()
export class SavedItemsService {
  constructor(
    private readonly savesService: SavesService,
    private readonly resourcesService: ResourcesService,
    private readonly researchNeedsService: ResearchNeedsService,
  ) {}

  async listForActor(actor: ActorContext): Promise<SavedItemResponse[]> {
    const [savedResources, savedNeeds] = await Promise.all([
      this.savesService.listSavedResourceIds(actor.userId),
      this.savesService.listSavedResearchNeedIds(actor.userId),
    ]);

    const resourceItems = await Promise.all(
      savedResources.map(async ({ resourceId, savedAt }): Promise<SavedItemResponse | null> => {
        try {
          const resource = await this.resourcesService.getById(actor, resourceId);
          return { type: "RESOURCE", savedAt: savedAt.toISOString(), resource };
        } catch {
          return null;
        }
      }),
    );
    const needItems = await Promise.all(
      savedNeeds.map(async ({ researchNeedId, savedAt }): Promise<SavedItemResponse | null> => {
        try {
          const researchNeed = await this.researchNeedsService.getById(actor, researchNeedId);
          return { type: "RESEARCH_NEED", savedAt: savedAt.toISOString(), researchNeed };
        } catch {
          return null;
        }
      }),
    );

    const items = [...resourceItems, ...needItems].filter((item): item is SavedItemResponse => item !== null);
    items.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    return items;
  }
}
