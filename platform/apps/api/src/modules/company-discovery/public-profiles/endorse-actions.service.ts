import type { EndorseActionResponse, MyEndorsementsResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { ConflictError, ErrorCode } from "@r2m/domain";
import { Injectable } from "@nestjs/common";
import { EndorsementsService } from "../../community/endorsements/endorsements.service";
import { PublicProfilesService } from "./public-profiles.service";

/** Community đợt 6 — endorse kỹ năng. Same separation-of-concerns reasoning as
 * `FollowActionsService`: `PublicProfilesService` stays `@Public()`-reads-only, this owns
 * the authenticated mutation/actor-specific-read side. The one thing `FollowActionsService`
 * doesn't need but this does: a tag must currently be one of the target author's
 * `expertise_tags` to be endorsable — checked here against
 * `PublicProfilesService.resolveAuthorForEndorsement`, since that free-text array has no
 * FK to constrain it at the DB layer. */
@Injectable()
export class EndorseActionsService {
  constructor(
    private readonly profiles: PublicProfilesService,
    private readonly endorsementsService: EndorsementsService,
  ) {}

  private async assertValidTag(slug: string, tag: string): Promise<string> {
    const author = await this.profiles.resolveAuthorForEndorsement(slug);
    if (!author.expertiseTags.includes(tag)) {
      throw new ConflictError(
        ErrorCode.PUBLIC_PROFILE_ENDORSEMENT_INVALID_TAG,
        "This tag is not currently one of the author's expertise tags.",
      );
    }
    return author.userId;
  }

  async endorse(actor: ActorContext, slug: string, tag: string): Promise<EndorseActionResponse> {
    const authorUserId = await this.assertValidTag(slug, tag);
    await this.endorsementsService.endorse(actor.userId, authorUserId, tag);
    const counts = await this.endorsementsService.countEndorsementsByTag(authorUserId, [tag]);
    return { tag, endorsed: true, endorsementCount: counts.get(tag) ?? 0 };
  }

  async unendorse(actor: ActorContext, slug: string, tag: string): Promise<EndorseActionResponse> {
    const authorUserId = await this.assertValidTag(slug, tag);
    await this.endorsementsService.unendorse(actor.userId, authorUserId, tag);
    const counts = await this.endorsementsService.countEndorsementsByTag(authorUserId, [tag]);
    return { tag, endorsed: false, endorsementCount: counts.get(tag) ?? 0 };
  }

  async myEndorsements(actor: ActorContext, slug: string): Promise<MyEndorsementsResponse> {
    const author = await this.profiles.resolveAuthorForEndorsement(slug);
    const endorsedTags = await this.endorsementsService.listEndorsedTags(actor.userId, author.userId);
    return { endorsedTags: [...endorsedTags] };
  }
}
