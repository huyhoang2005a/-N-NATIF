import { loadEnv } from "@r2m/config";
import { Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";

export interface AccessTokenPayload {
  sub: string; // userId
  tokenType: "access";
}

export interface RefreshTokenPayload {
  sub: string; // userId
  tokenType: "refresh";
  jti: string; // unique per issued refresh token, for future revocation lists
}

@Injectable()
export class TokenService {
  signAccessToken(userId: string): { token: string; expiresIn: number } {
    const env = loadEnv();
    const payload: AccessTokenPayload = { sub: userId, tokenType: "access" };
    const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    });
    return { token, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
  }

  signRefreshToken(userId: string, jti: string): { token: string; expiresIn: number } {
    const env = loadEnv();
    const payload: RefreshTokenPayload = { sub: userId, tokenType: "refresh", jti };
    const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_TTL_SECONDS,
    });
    return { token, expiresIn: env.JWT_REFRESH_TTL_SECONDS };
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    const env = loadEnv();
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
      return decoded.tokenType === "access" ? decoded : null;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    const env = loadEnv();
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
      return decoded.tokenType === "refresh" ? decoded : null;
    } catch {
      return null;
    }
  }
}
