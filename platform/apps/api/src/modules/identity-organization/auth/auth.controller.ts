import type {
  ChangePasswordRequest,
  LoginRequest,
  MeResponse,
  PendingMembershipResponse,
  RefreshRequest,
  TokenResponse,
} from "@r2m/contracts";
import { ChangePasswordRequestSchema, LoginRequestSchema, RefreshRequestSchema } from "@r2m/contracts";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { RateLimit } from "../../../common/decorators/rate-limit.decorator";
import { RateLimitGuard } from "../../../common/guards/rate-limit.guard";
import { S3Service } from "../../../common/storage/s3.service";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import type { ActorContext } from "@r2m/authz";
import { OrganizationsService } from "../organizations/organizations.service";
import { AuthService } from "./auth.service";

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly organizationsService: OrganizationsService,
    private readonly s3Service: S3Service,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: "login", points: 10, durationSeconds: 60 })
  @Post("auth/login")
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  login(@Body() body: LoginRequest): Promise<TokenResponse> {
    return this.authService.login(body);
  }

  @Public()
  @Post("auth/refresh")
  @UsePipes(new ZodValidationPipe(RefreshRequestSchema))
  refresh(@Body() body: RefreshRequest): Promise<TokenResponse> {
    return this.authService.refresh(body.refreshToken);
  }

  /**
   * Access/refresh tokens are stateless JWTs (no session table exists in the locked V5
   * schema yet), so logout is a client-side token discard. This endpoint exists to match
   * the API catalogue (§13.2) and gives a stable place to add server-side revocation if a
   * session entity is added to the spec later.
   */
  @Public()
  @Post("auth/logout")
  @HttpCode(204)
  logout(): void {
    // no-op by design — see comment above.
  }

  @Get("me")
  async me(@CurrentActor() actor: ActorContext): Promise<MeResponse> {
    const user = await this.db.query.userAccount.findFirst({
      where: eq(schema.userAccount.id, actor.userId),
    });
    const profile = await this.db.query.userProfile.findFirst({
      where: eq(schema.userProfile.userId, actor.userId),
    });
    const avatarUrl = profile?.avatarUrl ? (await this.s3Service.createResourceDownloadUrl(profile.avatarUrl)).url : null;
    return {
      userId: actor.userId,
      primaryEmail: user?.primaryEmail ?? "",
      platformRole: actor.platformRole,
      displayName: profile?.displayName ?? "",
      emailVerified: user?.emailVerifiedAt !== null && user?.emailVerifiedAt !== undefined,
      avatarUrl,
      authorVerificationStatus: actor.authorVerificationStatus,
    };
  }

  @Get("me/pending-memberships")
  listPendingMemberships(@CurrentActor() actor: ActorContext): Promise<PendingMembershipResponse[]> {
    return this.organizationsService.listPendingMemberships(actor);
  }

  @Patch("me/password")
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(ChangePasswordRequestSchema))
  async changePassword(
    @CurrentActor() actor: ActorContext,
    @Body() body: ChangePasswordRequest,
    @Req() req: Request,
  ): Promise<void> {
    const requestId = (req.headers["x-request-id"] as string) ?? null;
    await this.authService.changePassword(actor, body, requestId);
  }
}
