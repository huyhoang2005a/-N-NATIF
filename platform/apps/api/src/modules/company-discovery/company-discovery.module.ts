import { Module } from "@nestjs/common";
import { CommunityModule } from "../community/community.module";
import { OrganizationsModule } from "../identity-organization/organizations/organizations.module";
import { AuditModule } from "../platform-operations/audit/audit.module";
import { JobsModule } from "../platform-operations/jobs/jobs.module";
import { ResourceCatalogModule } from "../resource-catalog/resource-catalog.module";
import { TechnologyCaseModule } from "../technology-case/technology-case.module";
import { ActivityFeedController } from "./activity-feed/activity-feed.controller";
import { ActivityFeedService } from "./activity-feed/activity-feed.service";
import {
  CaseInitiationRequestsController,
  OrganizationCaseInitiationsController,
  RecommendationItemCaseInitiationsController,
} from "./case-initiations/case-initiations.controller";
import { CaseInitiationsRepository } from "./case-initiations/case-initiations.repository";
import { CaseInitiationsService } from "./case-initiations/case-initiations.service";
import { CompanyProfileController } from "./company-profile/company-profile.controller";
import { CompanyProfileRepository } from "./company-profile/company-profile.repository";
import { CompanyProfileService } from "./company-profile/company-profile.service";
import { ProposalsController, ResearchNeedProposalsController } from "./proposals/proposals.controller";
import { ProposalsRepository } from "./proposals/proposals.repository";
import { ProposalsService } from "./proposals/proposals.service";
import {
  CompanyProfileFeedController,
  RecommendationItemsController,
  RecommendationRunsController,
  ResearchNeedRecommendationRunsController,
} from "./recommendations/recommendations.controller";
import { RecommendationsRepository } from "./recommendations/recommendations.repository";
import { RecommendationsService } from "./recommendations/recommendations.service";
import { FollowActionsService } from "./public-profiles/follow-actions.service";
import {
  MeFollowsController,
  PublicAuthorProfileController,
  PublicOrganizationProfileController,
} from "./public-profiles/public-profiles.controller";
import { PublicProfilesRepository } from "./public-profiles/public-profiles.repository";
import { PublicProfilesService } from "./public-profiles/public-profiles.service";
import { OrganizationResearchNeedsController, ResearchNeedsController } from "./research-needs/research-needs.controller";
import { ResearchNeedsRepository } from "./research-needs/research-needs.repository";
import { ResearchNeedsService } from "./research-needs/research-needs.service";
import { SavedItemsController } from "./saved-items/saved-items.controller";
import { SavedItemsService } from "./saved-items/saved-items.service";

/** Company & Discovery bounded context (Phase 5, §9.8). 1 aggregator module for the
 * whole context, sub-features added sprint by sprint (5.1 Company Profile, 5.2 Research
 * Need, 5.3 Research Proposal, 5.4 AI Recommendation FOCUSED so far). Imports
 * `TechnologyCaseModule` to reuse `TechnologyCaseService.createCaseCore` when a proposal
 * is accepted — same shared case-creation transaction as Phase 3's manual `register()`,
 * not a second copy. Imports `JobsModule` for `OutboxService` — recommendation runs are
 * generated asynchronously by the worker via the same outbox pattern as every other
 * side-effect in this app, no separate queue infra. */
@Module({
  imports: [OrganizationsModule, AuditModule, JobsModule, TechnologyCaseModule, CommunityModule, ResourceCatalogModule],
  controllers: [
    CompanyProfileController,
    ResearchNeedsController,
    OrganizationResearchNeedsController,
    ResearchNeedProposalsController,
    ProposalsController,
    ResearchNeedRecommendationRunsController,
    RecommendationRunsController,
    CompanyProfileFeedController,
    RecommendationItemsController,
    RecommendationItemCaseInitiationsController,
    CaseInitiationRequestsController,
    OrganizationCaseInitiationsController,
    PublicAuthorProfileController,
    PublicOrganizationProfileController,
    MeFollowsController,
    SavedItemsController,
    ActivityFeedController,
  ],
  providers: [
    CompanyProfileRepository,
    CompanyProfileService,
    ResearchNeedsRepository,
    ResearchNeedsService,
    ProposalsRepository,
    ProposalsService,
    RecommendationsRepository,
    RecommendationsService,
    CaseInitiationsRepository,
    CaseInitiationsService,
    PublicProfilesRepository,
    PublicProfilesService,
    FollowActionsService,
    SavedItemsService,
    ActivityFeedService,
  ],
})
export class CompanyDiscoveryModule {}
