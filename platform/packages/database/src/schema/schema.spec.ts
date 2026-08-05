import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { organization, organizationMember } from "./organization";
import { userAccount } from "./identity";
import { outboxEvent } from "./platform-ops";

describe("drizzle schema shape", () => {
  it("organization has the version + updated_at pair required for optimistic concurrency", () => {
    const columns = getTableColumns(organization);
    expect(columns.version).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("organization_member exposes the columns the partial unique index relies on", () => {
    const columns = getTableColumns(organizationMember);
    expect(columns.organizationId).toBeDefined();
    expect(columns.role).toBeDefined();
    expect(columns.status).toBeDefined();
  });

  it("user_account primary_email is backed by citext (case-insensitive uniqueness)", () => {
    const columns = getTableColumns(userAccount);
    expect(columns.primaryEmail.getSQLType()).toBe("citext");
  });

  it("outbox_event carries the columns the dispatcher polls on", () => {
    const columns = getTableColumns(outboxEvent);
    expect(columns.status).toBeDefined();
    expect(columns.availableAt).toBeDefined();
    expect(columns.attemptCount).toBeDefined();
  });
});
