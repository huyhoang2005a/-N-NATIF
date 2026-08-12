import type { ChangePasswordRequest, LoginRequest, TokenResponse } from "@r2m/contracts";
import { ErrorCode, ForbiddenError, UnauthenticatedError } from "@r2m/domain";
import type { ActorContext } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { AuthRepository } from "./auth.repository";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async login(request: LoginRequest): Promise<TokenResponse> {
    const found = await this.authRepository.findLocalIdentityByEmail(request.email);
    if (!found || !found.identity.passwordHash) {
      throw new UnauthenticatedError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(request.password, found.identity.passwordHash);
    if (!passwordMatches) {
      throw new UnauthenticatedError(ErrorCode.AUTH_INVALID_CREDENTIALS, "Invalid email or password.");
    }

    if (found.user.status !== "ACTIVE") {
      throw new UnauthenticatedError(ErrorCode.AUTH_ACCOUNT_SUSPENDED, "Account is not active.");
    }

    await this.authRepository.touchLastLogin(found.user.id);
    return this.issueTokens(found.user.id);
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthenticatedError(ErrorCode.AUTH_INVALID_REFRESH_TOKEN, "Invalid or expired refresh token.");
    }

    const user = await this.authRepository.findUserById(payload.sub);
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthenticatedError(ErrorCode.AUTH_ACCOUNT_SUSPENDED, "Account is not active.");
    }

    return this.issueTokens(user.id);
  }

  /** Not spec-mandated (docs/spec/ has no change-password UC) — explicit user-approved
   * addition, same footing as the join-org flow. Requires the current password (defense
   * against a stolen access token being enough to lock the real owner out). */
  async changePassword(actor: ActorContext, request: ChangePasswordRequest, requestId: string | null): Promise<void> {
    const identity = await this.authRepository.findLocalIdentityByUserId(actor.userId);
    if (!identity || !identity.passwordHash) {
      throw new UnauthenticatedError(ErrorCode.AUTH_INVALID_CREDENTIALS, "No local password credential for this account.");
    }

    const currentMatches = await bcrypt.compare(request.currentPassword, identity.passwordHash);
    if (!currentMatches) {
      throw new ForbiddenError(ErrorCode.AUTH_CURRENT_PASSWORD_INVALID, "Current password is incorrect.");
    }

    const newHash = await bcrypt.hash(request.newPassword, 10);
    await this.db.transaction(async (tx) => {
      await this.authRepository.updatePasswordHash(identity.id, newHash, tx);
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId,
          action: "user_identity.change_password",
          entityType: "user_identity",
          entityId: identity.id,
        },
        tx,
      );
    });
  }

  private issueTokens(userId: string): TokenResponse {
    const access = this.tokenService.signAccessToken(userId);
    const refresh = this.tokenService.signRefreshToken(userId, uuidv4());
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      tokenType: "Bearer",
      expiresIn: access.expiresIn,
    };
  }
}
