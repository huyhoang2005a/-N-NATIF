import type { UpdateProfileRequest, UserProfileResponse } from "@r2m/contracts";
import { UpdateProfileRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Patch, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { UsersService } from "./users.service";

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
    const requestId = (req.headers["x-request-id"] as string) ?? null;
    return this.usersService.updateMyProfile(actor, body, requestId);
  }
}
