import type {
  AvatarUploadResponse,
  PlatformUserDetailResponse,
  PlatformUserResponse,
  PlatformUserStatsResponse,
  RequestAvatarUploadRequest,
  SuspendUserRequest,
  UpdateAvatarRequest,
  UpdateProfileRequest,
  UserProfileResponse,
  UserPublicInfoResponse,
} from "@r2m/contracts";
import { RequestAvatarUploadSchema, SuspendUserRequestSchema, UpdateAvatarRequestSchema, UpdateProfileRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { parsePageLimit, parsePageOffset } from "../../../common/pagination/parse-page-params.util";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("me/profile")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getProfile(@CurrentActor() actor: ActorContext): Promise<UserProfileResponse> {
    return this.usersService.getMyProfile(actor);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateProfileRequestSchema))
  updateProfile(
    @CurrentActor() actor: ActorContext,
    @Body() body: UpdateProfileRequest,
    @Req() req: Request,
  ): Promise<UserProfileResponse> {
    return this.usersService.updateMyProfile(actor, body, requestId(req));
  }
}

/** Not spec-mandated — explicit user-approved addition. Separate controller (own path
 * prefix `me/avatar`) rather than folding into `UsersController` — keeps the upload/
 * MIME-sniff/malware-scan concern isolated from the plain-field profile PATCH above. */
@Controller("me/avatar")
export class UserAvatarController {
  constructor(private readonly usersService: UsersService) {}

  @Post("uploads")
  @UsePipes(new ZodValidationPipe(RequestAvatarUploadSchema))
  requestUpload(@CurrentActor() actor: ActorContext, @Body() body: RequestAvatarUploadRequest): Promise<AvatarUploadResponse> {
    return this.usersService.requestAvatarUpload(actor, body);
  }

  @Put()
  @UsePipes(new ZodValidationPipe(UpdateAvatarRequestSchema))
  update(@CurrentActor() actor: ActorContext, @Body() body: UpdateAvatarRequest, @Req() req: Request): Promise<UserProfileResponse> {
    return this.usersService.updateMyAvatar(actor, body.storageObjectKey, requestId(req));
  }

  @Delete()
  remove(@CurrentActor() actor: ActorContext, @Req() req: Request): Promise<UserProfileResponse> {
    return this.usersService.removeMyAvatar(actor, requestId(req));
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LOOKUP_IDS = 100;

/** Not spec-mandated — explicit user-approved addition (see [[r2m_frontend_status]]'s
 * "no endpoint to look up another user's display name" gap). Any authenticated actor
 * may resolve a batch of userIds to display names; no other profile field is exposed. */
@Controller("users")
export class UserDirectoryController {
  constructor(private readonly usersService: UsersService) {}

  @Get("public-info")
  getPublicInfo(@Query("ids") ids: string | undefined): Promise<UserPublicInfoResponse[]> {
    const userIds = (ids ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (userIds.length === 0) {
      throw new BadRequestException("Query parameter 'ids' must contain at least 1 user id.");
    }
    if (userIds.length > MAX_LOOKUP_IDS) {
      throw new BadRequestException(`Query parameter 'ids' must contain at most ${MAX_LOOKUP_IDS} user ids.`);
    }
    if (!userIds.every((id) => UUID_RE.test(id))) {
      throw new BadRequestException("Query parameter 'ids' must be a comma-separated list of UUIDs.");
    }
    return this.usersService.getPublicInfo(userIds);
  }
}

/** Not spec-mandated — explicit user-approved addition, see users.service.ts. */
@Controller("platform/users")
export class PlatformUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listAll(
    @CurrentActor() actor: ActorContext,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<PlatformUserResponse[]> {
    return this.usersService.listAllForPlatform(actor, parsePageLimit(limit), parsePageOffset(offset));
  }

  @Get("stats")
  stats(@CurrentActor() actor: ActorContext): Promise<PlatformUserStatsResponse> {
    return this.usersService.statsForPlatform(actor);
  }

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<PlatformUserDetailResponse> {
    return this.usersService.getByIdForPlatform(actor, id);
  }

  @Post(":id/suspend")
  @UsePipes(new ZodValidationPipe(SuspendUserRequestSchema))
  suspend(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: SuspendUserRequest,
    @Req() req: Request,
  ): Promise<PlatformUserResponse> {
    return this.usersService.suspend(actor, id, body.reason, requestId(req));
  }

  @Post(":id/reactivate")
  reactivate(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<PlatformUserResponse> {
    return this.usersService.reactivate(actor, id, requestId(req));
  }
}
