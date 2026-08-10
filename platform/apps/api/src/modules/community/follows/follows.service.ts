import { Injectable } from "@nestjs/common";
import { FollowsRepository } from "./follows.repository";

/** Community layer, đợt 3 (follow). Target-agnostic naming mirrors `VotesService`/
 * `SavesService`, but — unlike those — `author` and `organization` follow live in 2
 * separate tables (each has exactly one target column, no "1-of-2 nullable" FK pattern),
 * so this service just forwards to the matching repository method pair per target type. */
@Injectable()
export class FollowsService {
  constructor(private readonly repository: FollowsRepository) {}

  followAuthor(followerUserId: string, followedAuthorUserId: string): Promise<boolean> {
    return this.repository.followAuthor(followerUserId, followedAuthorUserId);
  }

  unfollowAuthor(followerUserId: string, followedAuthorUserId: string): Promise<void> {
    return this.repository.unfollowAuthor(followerUserId, followedAuthorUserId);
  }

  isFollowingAuthor(followerUserId: string, followedAuthorUserId: string): Promise<boolean> {
    return this.repository.isFollowingAuthor(followerUserId, followedAuthorUserId);
  }

  countAuthorFollowers(followedAuthorUserId: string): Promise<number> {
    return this.repository.countAuthorFollowers(followedAuthorUserId);
  }

  listFollowedAuthorIds(followerUserId: string): Promise<string[]> {
    return this.repository.listFollowedAuthorIds(followerUserId);
  }

  followOrganization(followerUserId: string, followedOrganizationId: string): Promise<boolean> {
    return this.repository.followOrganization(followerUserId, followedOrganizationId);
  }

  unfollowOrganization(followerUserId: string, followedOrganizationId: string): Promise<void> {
    return this.repository.unfollowOrganization(followerUserId, followedOrganizationId);
  }

  isFollowingOrganization(followerUserId: string, followedOrganizationId: string): Promise<boolean> {
    return this.repository.isFollowingOrganization(followerUserId, followedOrganizationId);
  }

  countOrganizationFollowers(followedOrganizationId: string): Promise<number> {
    return this.repository.countOrganizationFollowers(followedOrganizationId);
  }

  listFollowedOrganizationIds(followerUserId: string): Promise<string[]> {
    return this.repository.listFollowedOrganizationIds(followerUserId);
  }
}
