import type { LoginRequest, TokenResponse } from "@r2m/contracts";
import { ErrorCode, UnauthenticatedError } from "@r2m/domain";
import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { AuthRepository } from "./auth.repository";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
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
