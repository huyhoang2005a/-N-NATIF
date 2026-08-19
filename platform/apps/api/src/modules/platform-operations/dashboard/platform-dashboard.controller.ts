import type { PlatformDashboardResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Controller, Get } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { PlatformDashboardService } from "./platform-dashboard.service";

@Controller("platform/dashboard-stats")
export class PlatformDashboardController {
  constructor(private readonly dashboardService: PlatformDashboardService) {}

  @Get()
  get(@CurrentActor() actor: ActorContext): Promise<PlatformDashboardResponse> {
    return this.dashboardService.getDashboard(actor);
  }
}
