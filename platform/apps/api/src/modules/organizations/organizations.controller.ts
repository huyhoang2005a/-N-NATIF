import type {
  InviteMemberRequest,
  OrganizationMemberResponse,
  OrganizationResponse,
  RegisterOrganizationRequest,
  UpdateMemberRequest,
} from "@r2m/contracts";
import {
  InviteMemberRequestSchema,
  RegisterOrganizationRequestSchema,
  UpdateMemberRequestSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Patch, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { OrganizationsService } from "./organizations.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Public()
  @Post("register")
  @UsePipes(new ZodValidationPipe(RegisterOrganizationRequestSchema))
  register(
    @Body() body: RegisterOrganizationRequest,
    @Req() req: Request,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.register(body, requestId(req));
  }

  @Get()
  listMine(@CurrentActor() actor: ActorContext): Promise<OrganizationResponse[]> {
    return this.organizationsService.listMine(actor);
  }

  @Get(":id")
  getById(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.getById(actor, id);
  }

  @Post(":id/members/invitations")
  @UsePipes(new ZodValidationPipe(InviteMemberRequestSchema))
  inviteMember(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: InviteMemberRequest,
    @Req() req: Request,
  ): Promise<OrganizationMemberResponse> {
    return this.organizationsService.inviteMember(actor, id, body, requestId(req));
  }

  @Patch(":id/members/:memberId")
  @UsePipes(new ZodValidationPipe(UpdateMemberRequestSchema))
  updateMember(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() body: UpdateMemberRequest,
    @Req() req: Request,
  ): Promise<OrganizationMemberResponse> {
    return this.organizationsService.updateMember(actor, id, memberId, body, requestId(req));
  }
}
