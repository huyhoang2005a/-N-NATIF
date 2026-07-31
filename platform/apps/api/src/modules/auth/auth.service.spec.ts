import * as bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import type { AuthRepository } from "./auth.repository";
import type { TokenService } from "./token.service";

function buildDeps() {
  const authRepository = {
    findLocalIdentityByEmail: vi.fn(),
    findUserById: vi.fn(),
    touchLastLogin: vi.fn(),
  } as unknown as AuthRepository;

  const tokenService = {
    signAccessToken: vi.fn().mockReturnValue({ token: "access-token", expiresIn: 900 }),
    signRefreshToken: vi.fn().mockReturnValue({ token: "refresh-token", expiresIn: 2592000 }),
    verifyRefreshToken: vi.fn(),
  } as unknown as TokenService;

  return { authRepository, tokenService };
}

describe("AuthService.login", () => {
  let deps: ReturnType<typeof buildDeps>;
  let service: AuthService;

  beforeEach(() => {
    deps = buildDeps();
    service = new AuthService(deps.authRepository, deps.tokenService);
  });

  it("issues tokens for a correct email/password against an ACTIVE account", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    vi.mocked(deps.authRepository.findLocalIdentityByEmail).mockResolvedValue({
      identity: { passwordHash } as never,
      user: { id: "user-1", status: "ACTIVE" } as never,
    });

    const result = await service.login({ email: "a@b.com", password: "correct-password" });

    expect(result.accessToken).toBe("access-token");
    expect(deps.authRepository.touchLastLogin).toHaveBeenCalledWith("user-1");
  });

  it("throws AUTH_INVALID_CREDENTIALS for an unknown email", async () => {
    vi.mocked(deps.authRepository.findLocalIdentityByEmail).mockResolvedValue(null);

    await expect(service.login({ email: "nobody@b.com", password: "x" })).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });

  it("throws AUTH_INVALID_CREDENTIALS for a wrong password without revealing which side is wrong", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    vi.mocked(deps.authRepository.findLocalIdentityByEmail).mockResolvedValue({
      identity: { passwordHash } as never,
      user: { id: "user-1", status: "ACTIVE" } as never,
    });

    await expect(service.login({ email: "a@b.com", password: "wrong" })).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });

  it("throws AUTH_ACCOUNT_SUSPENDED for a correct password on a SUSPENDED account", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    vi.mocked(deps.authRepository.findLocalIdentityByEmail).mockResolvedValue({
      identity: { passwordHash } as never,
      user: { id: "user-1", status: "SUSPENDED" } as never,
    });

    await expect(service.login({ email: "a@b.com", password: "correct-password" })).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_SUSPENDED",
    });
  });
});

describe("AuthService.refresh", () => {
  it("rejects an invalid refresh token", async () => {
    const deps = buildDeps();
    vi.mocked(deps.tokenService.verifyRefreshToken).mockReturnValue(null);
    const service = new AuthService(deps.authRepository, deps.tokenService);

    await expect(service.refresh("garbage")).rejects.toMatchObject({
      code: "AUTH_INVALID_REFRESH_TOKEN",
    });
  });

  it("issues a fresh token pair for a valid refresh token on an ACTIVE account", async () => {
    const deps = buildDeps();
    vi.mocked(deps.tokenService.verifyRefreshToken).mockReturnValue({
      sub: "user-1",
      tokenType: "refresh",
      jti: "abc",
    });
    vi.mocked(deps.authRepository.findUserById).mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
    } as never);
    const service = new AuthService(deps.authRepository, deps.tokenService);

    const result = await service.refresh("valid-refresh-token");
    expect(result.accessToken).toBe("access-token");
  });
});
