import type { SavedItemResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Controller, Get } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { SavedItemsService } from "./saved-items.service";

@Controller("me/saved")
export class SavedItemsController {
  constructor(private readonly service: SavedItemsService) {}

  @Get()
  list(@CurrentActor() actor: ActorContext): Promise<SavedItemResponse[]> {
    return this.service.listForActor(actor);
  }
}
