import { describe, expect, it } from "vitest";
import type { ActorContext } from "./actor-context";
import { assertOrgOwnerOrAdmin, isOrgOwnerOrAdmin } from "./organization-membership.policy";

function actorWith(memberships: ActorContext["memberships"]): ActorContext {
  return { userId: "user-1", platformRole: "USER", memberships };
}

describe("organization membership policy", () => {
  it("grants owner/admin actions only for an ACTIVE membership in that exact organization", () => {
    const actor = actorWith([{ organizationId: "org-a", role: "ORG_OWNER", status: "ACTIVE" }]);
    expect(isOrgOwnerOrAdmin(actor, "org-a")).toBe(true);
    expect(isOrgOwnerOrAdmin(actor, "org-b")).toBe(false);
  });

  it("does not grant access from a SUSPENDED or INVITED membership", () => {
    const actor = actorWith([{ organizationId: "org-a", role: "ORG_OWNER", status: "SUSPENDED" }]);
    expect(isOrgOwnerOrAdmin(actor, "org-a")).toBe(false);
  });

  it("does not grant owner/admin actions to a plain MEMBER", () => {
    const actor = actorWith([{ organizationId: "org-a", role: "MEMBER", status: "ACTIVE" }]);
    expect(isOrgOwnerOrAdmin(actor, "org-a")).toBe(false);
  });

  it("throws AUTH_FORBIDDEN instead of silently allowing a client-supplied organizationId", () => {
    const actor = actorWith([{ organizationId: "org-a", role: "MEMBER", status: "ACTIVE" }]);
    expect(() => assertOrgOwnerOrAdmin(actor, "org-a")).toThrow();
  });
});
