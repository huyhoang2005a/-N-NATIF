import * as bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import type { AuthRepository } from "./auth.repository";
import type { TokenService } from "./token.service";
import type { AuditService } from "../../platform-operations/audit/audit.service";
import type { Database } from "@r2m/database";

function buildDeps() {
  const authRepository = {
    findLocalIdentityByEmail: vi.fn(),
    findLocalIdentityByUserId: vi.fn(),
    findUserById: vi.fn(),
    touchLastLogin: vi.fn(),
    updatePasswordHash: vi.fn(),
    // Default: not an ORG_OWNER of any organization — matches every pre-existing test's
    // account (none of them registered an org), so the login-gate added alongside this
    // method (see auth.service.ts) never fires unless a test explicitly overrides it.
    findOwnedOrganizationStatus: vi.fn().mockResolvedValue(null),
  } as unknown as AuthRepository;

  const tokenService = {
    signAccessToken: vi.fn().mockReturnValue({ token: "access-token", expiresIn: 900 }),
    signRefreshToken: vi.fn().mockReturnValue({ token: "refresh-token", expiresIn: 2592000 }),
    verifyRefreshToken: vi.fn(),
  } as unknown as TokenService;

  const auditService = { write: vi.fn() } as unknown as AuditService;
  const db = { transaction: vi.fn((fn: (tx: Database) => unknown) => fn({} as Database)) } as unknown as Database;

  return { authRepository, tokenService, auditService, db };
}

describe("AuthService.login", () => {
  let deps: ReturnType<typeof buildDeps>;
  let service: AuthService;

  beforeEach(() => {
    deps = buildDeps();
    service = new AuthService(deps.authRepository, deps.tokenService, deps.auditService, deps.db);
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

  it("throws AUTH_ORGANIZATION_PENDING_VERIFICATION for an ORG_OWNER whose org isn't approved yet", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    vi.mocked(deps.authRepository.findLocalIdentityByEmail).mockResolvedValue({
      identity: { passwordHash } as never,
      user: { id: "user-1", status: "ACTIVE" } as never,
    });
    vi.mocked(deps.authRepository.findOwnedOrganizationStatus).mockResolvedValue({
      status: "PENDING_VERIFICATION",
    } as never);

    await expect(service.login({ email: "a@b.com", password: "correct-password" })).rejects.toMatchObject({
      code: "AUTH_ORGANIZATION_PENDING_VERIFICATION",
    });
  });

  it("throws AUTH_ORGANIZATION_REJECTED for an ORG_OWNER whose org was rejected", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    vi.mocked(deps.authRepository.findLocalIdentityByEmail).mockResolvedValue({
      identity: { passwordHash } as never,
      user: { id: "user-1", status: "ACTIVE" } as never,
    });
    vi.mocked(deps.authRepository.findOwnedOrganizationStatus).mockResolvedValue({
      status: "REJECTED",
    } as never);

    await expect(service.login({ email: "a@b.com", password: "correct-password" })).rejects.toMatchObject({
      code: "AUTH_ORGANIZATION_REJECTED",
    });
  });

  it("issues tokens for an ORG_OWNER whose organization is ACTIVE", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    vi.mocked(deps.authRepository.findLocalIdentityByEmail).mockResolvedValue({
      identity: { passwordHash } as never,
      user: { id: "user-1", status: "ACTIVE" } as never,
    });
    vi.mocked(deps.authRepository.findOwnedOrganizationStatus).mockResolvedValue({
      status: "ACTIVE",
    } as never);

    const result = await service.login({ email: "a@b.com", password: "correct-password" });

    expect(result.accessToken).toBe("access-token");
  });
});

describe("AuthService.refresh", () => {
  it("rejects an invalid refresh token", async () => {
    const deps = buildDeps();
    vi.mocked(deps.tokenService.verifyRefreshToken).mockReturnValue(null);
    const service = new AuthService(deps.authRepository, deps.tokenService, deps.auditService, deps.db);

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
    const service = new AuthService(deps.authRepository, deps.tokenService, deps.auditService, deps.db);

    const result = await service.refresh("valid-refresh-token");
    expect(result.accessToken).toBe("access-token");
  });
});
