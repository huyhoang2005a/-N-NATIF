import { ErrorCode, UnauthenticatedError } from "@r2m/domain";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { DATABASE } from "../../database/database.module";
import { TokenService } from "../../modules/identity-organization/auth/token.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Verifies the access token, then re-reads the user + active memberships from the
 * database on every request to build ActorContext. Nothing about tenant scope or role
 * is ever taken from the token/client — see architecture plan §7.3.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { actor?: unknown }>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthenticatedError(ErrorCode.AUTH_UNAUTHENTICATED, "Missing bearer token.");
    }

    const payload = this.tokenService.verifyAccessToken(authHeader.slice("Bearer ".length));
    if (!payload) {
      throw new UnauthenticatedError(ErrorCode.AUTH_UNAUTHENTICATED, "Invalid or expired access token.");
    }

    const user = await this.db.query.userAccount.findFirst({
      where: eq(schema.userAccount.id, payload.sub),
    });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthenticatedError(
        ErrorCode.AUTH_ACCOUNT_SUSPENDED,
        "Account is not active.",
      );
    }

    const memberships = await this.db.query.organizationMember.findMany({
      where: eq(schema.organizationMember.userId, user.id),
    });

    const authorProfile = await this.db.query.authorProfile.findFirst({
      where: eq(schema.authorProfile.userId, user.id),
    });

    request.actor = {
      userId: user.id,
      platformRole: user.platformRole,
      memberships: memberships.map((membership) => ({
        organizationId: membership.organizationId,
        role: membership.role,
        status: membership.status,
      })),
      authorVerificationStatus: authorProfile?.verificationStatus ?? "UNVERIFIED",
    };

    return true;
  }
}
