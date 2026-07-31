import { describe, expect, it, vi } from "vitest";
import { dispatchPendingEvents } from "./outbox-dispatcher";

function buildFakeDb(rows: unknown[], overrides: Partial<Record<string, unknown>> = {}) {
  const updateCalls: unknown[] = [];
  const insertCalls: unknown[] = [];

  const db = {
    query: {
      outboxEvent: { findMany: vi.fn().mockResolvedValue(rows) },
      organizationMember: { findFirst: vi.fn().mockResolvedValue(undefined) },
      userAccount: { findMany: vi.fn().mockResolvedValue([]) },
      ...overrides,
    },
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => ({
        where: vi.fn(async () => {
          updateCalls.push(values);
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: unknown) => {
        insertCalls.push(values);
      }),
    })),
  };

  return { db, updateCalls, insertCalls };
}

describe("dispatchPendingEvents", () => {
  it("marks an unhandled/failing event FAILED and increments attempt_count", async () => {
    const { db, updateCalls } = buildFakeDb([
      {
        id: "evt-1",
        eventType: "SomeUnknownEvent",
        payload: { type: "SomeUnknownEvent" },
        attemptCount: 0,
      },
    ]);

    const result = await dispatchPendingEvents(db as never, { maxAttempts: 5 });

    expect(result.failed).toBe(1);
    expect(updateCalls).toContainEqual(expect.objectContaining({ status: "PROCESSING" }));
    expect(updateCalls).toContainEqual(expect.objectContaining({ status: "FAILED", attemptCount: 1 }));
  });

  it("moves an event to DEAD_LETTER once attempt_count reaches maxAttempts", async () => {
    const { db, updateCalls } = buildFakeDb([
      {
        id: "evt-1",
        eventType: "SomeUnknownEvent",
        payload: { type: "SomeUnknownEvent" },
        attemptCount: 4,
      },
    ]);

    await dispatchPendingEvents(db as never, { maxAttempts: 5 });

    expect(updateCalls).toContainEqual(
      expect.objectContaining({ status: "DEAD_LETTER", attemptCount: 5 }),
    );
  });

  it("delivers OrganizationMemberInvited as a notification to the invited user", async () => {
    const { db, insertCalls, updateCalls } = buildFakeDb([
      {
        id: "evt-1",
        eventType: "OrganizationMemberInvited",
        payload: {
          type: "OrganizationMemberInvited",
          organizationId: "org-1",
          memberId: "member-1",
          invitedUserId: "user-2",
          invitedByUserId: "user-1",
          role: "MEMBER",
        },
        attemptCount: 0,
      },
    ]);

    const result = await dispatchPendingEvents(db as never);

    expect(result.processed).toBe(1);
    expect(insertCalls).toContainEqual(expect.objectContaining({ recipientUserId: "user-2" }));
    expect(updateCalls).toContainEqual(expect.objectContaining({ status: "PUBLISHED" }));
  });

  it("acknowledges OrganizationRegistered without creating a notification", async () => {
    const { db, insertCalls } = buildFakeDb([
      {
        id: "evt-1",
        eventType: "OrganizationRegistered",
        payload: {
          type: "OrganizationRegistered",
          organizationId: "org-1",
          ownerUserId: "user-1",
          organizationType: "RESEARCH_UNIT",
          requiresManualVerification: true,
        },
        attemptCount: 0,
      },
    ]);

    const result = await dispatchPendingEvents(db as never);

    expect(result.processed).toBe(1);
    expect(insertCalls).toHaveLength(0);
  });
});
