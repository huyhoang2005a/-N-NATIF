import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { UsersService } from "./users.service";
import type { UsersRepository } from "./users.repository";
import type { AuditService } from "../../platform-operations/audit/audit.service";
import type { OutboxService } from "../../platform-operations/jobs/outbox.service";

const actor: ActorContext = {
  userId: "user-1",
  platformRole: "USER",
  memberships: [],
  authorVerificationStatus: "UNVERIFIED",
  isEmailVerified: true,
};

describe("UsersService.updateMyProfile", () => {
  it("writes the profile update, an audit row and an outbox event in one transaction", async () => {
    const before = { userId: "user-1", displayName: "Old Name" };
    const after = { userId: "user-1", displayName: "New Name" };

    const usersRepository = {
      getProfile: vi.fn().mockResolvedValue(before),
      updateProfile: vi.fn().mockResolvedValue(after),
    } as unknown as UsersRepository;

    const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;

    const fakeTx = { marker: "tx" };
    const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(fakeTx)) };

    const service = new UsersService(usersRepository, auditService, outboxService, db as never);

    const result = await service.updateMyProfile(actor, { displayName: "New Name" }, "req-1");

    expect(usersRepository.updateProfile).toHaveBeenCalledWith("user-1", { displayName: "New Name" }, fakeTx);
    expect(auditService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user_profile.update", entityId: "user-1" }),
      fakeTx,
    );
    expect(outboxService.append).toHaveBeenCalledWith(
      "user_profile",
      "user-1",
      expect.objectContaining({ type: "UserProfileUpdated", changedFields: ["displayName"] }),
      fakeTx,
    );
    expect(result.displayName).toBe("New Name");
  });
});
