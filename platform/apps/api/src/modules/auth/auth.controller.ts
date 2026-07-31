import type { LoginRequest, MeResponse, RefreshRequest, TokenResponse } from "@r2m/contracts";
import { LoginRequestSchema, RefreshRequestSchema } from "@r2m/contracts";
import type { Database } from "@r2m/db";
import { schema } from "@r2m/db";
import { Body, Controller, Get, HttpCode, Inject, Post, UsePipes } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { ActorContext } from "@r2m/authz";
import type { AuthService } from "./auth.service";

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  @Public()
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
    return {
      userId: actor.userId,
      primaryEmail: user?.primaryEmail ?? "",
      platformRole: actor.platformRole,
      displayName: profile?.displayName ?? "",
    };
  }
}
