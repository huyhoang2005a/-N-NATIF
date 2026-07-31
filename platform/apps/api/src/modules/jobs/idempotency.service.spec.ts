import { describe, expect, it, vi } from "vitest";
import { IdempotencyService } from "./idempotency.service";

function buildFakeDb(existingRow: unknown) {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const db = {
    query: {
      idempotencyKey: {
        findFirst: vi.fn().mockResolvedValue(existingRow),
      },
    },
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
  };
  return { db, insertValues, updateWhere };
}

describe("IdempotencyService.withIdempotency", () => {
  it("runs the command and stores the response on first call", async () => {
    const { db, insertValues, updateWhere } = buildFakeDb(null);
    const service = new IdempotencyService(db as never);
    const run = vi.fn().mockResolvedValue({ status: 201, body: { id: "org-1" } });

    const result = await service.withIdempotency("user-1", "key-1", "hash-1", run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(updateWhere).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 201, body: { id: "org-1" } });
  });

  it("replays the stored response instead of re-running the command", async () => {
    const { db } = buildFakeDb({
      userId: "user-1",
      key: "key-1",
      requestHash: "hash-1",
      responseStatus: 201,
      responseBody: { id: "org-1" },
    });
    const service = new IdempotencyService(db as never);
    const run = vi.fn();

    const result = await service.withIdempotency("user-1", "key-1", "hash-1", run);

    expect(run).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 201, body: { id: "org-1" } });
  });

  it("rejects reusing the same key with a different request payload", async () => {
    const { db } = buildFakeDb({
      userId: "user-1",
      key: "key-1",
      requestHash: "hash-1",
      responseStatus: 201,
      responseBody: { id: "org-1" },
    });
    const service = new IdempotencyService(db as never);
    const run = vi.fn();

    await expect(
      service.withIdempotency("user-1", "key-1", "hash-DIFFERENT", run),
    ).rejects.toMatchObject({ code: "SYSTEM_IDEMPOTENCY_KEY_REUSED" });
    expect(run).not.toHaveBeenCalled();
  });
});
