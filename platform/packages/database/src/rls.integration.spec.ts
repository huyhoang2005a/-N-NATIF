import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, getPool } from "./client";
import * as schema from "./schema";

/**
 * Phase 7 Sprint 7.1 — proves docs/ops/enable-rls.sql actually enforces cross-tenant
 * isolation, per the spec's own required ordering ("Viết integration test đầy đủ... trước
 * khi bật RLS"). Requires a live DB connection (DATABASE_URL) — same requirement as
 * `pnpm migrate`, unlike schema.spec.ts's pure static checks.
 *
 * Everything (enabling RLS, the fixture rows, all of it) runs inside ONE transaction that
 * is always rolled back — via a forced-throw sentinel, not by letting the callback return
 * normally, so a rollback happens even when every assertion passes. RLS/CREATE POLICY/
 * CREATE FUNCTION are all transactional DDL in Postgres, so ROLLBACK genuinely undoes them;
 * the real dev DB never has RLS left enabled after this test runs, matching the "chuẩn bị
 * sẵn sàng, chưa bật" decision for this environment.
 *
 * Reads the actual enable-rls.sql file (not a copy) so the test always exercises exactly
 * what the runbook would apply — single source of truth.
 */

class ForceRollback extends Error {}

// The file wraps itself in its own BEGIN/COMMIT so it's atomic when run standalone via the
// runbook — but this test already runs everything inside its own `db.transaction()`, and a
// literal `COMMIT;` embedded mid-string would prematurely commit that outer transaction
// (Postgres treats a nested `BEGIN;` as a no-op-with-warning, but `COMMIT;` really commits).
// Strip the file's own wrapper lines so it composes safely inside the test's transaction.
const ENABLE_RLS_SQL = readFileSync(join(__dirname, "..", "..", "..", "docs", "ops", "enable-rls.sql"), "utf-8")
  .split("\n")
  .filter((line) => line.trim() !== "BEGIN;" && line.trim() !== "COMMIT;")
  .join("\n");

describe("RLS cross-tenant isolation (docs/ops/enable-rls.sql)", () => {
  afterAll(async () => {
    await getPool().end();
  });

  it("blocks cross-tenant reads on technology_case, resource, research_need, evidence — but not PUBLIC resources", async () => {
    const db = getDb();

    interface Captured {
      caseRowsAsUserA: { id: string }[];
      resourceRowsAsUserA: { id: string }[];
      researchNeedRowsAsUserA: { id: string }[];
      evidenceRowsAsUserA: { id: string }[];
      caseAId: string;
      caseBId: string;
      privateResourceBId: string;
      publicResourceBId: string;
      researchNeedBId: string;
      evidenceBId: string;
    }
    let captured: Captured | undefined;

    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql.raw(ENABLE_RLS_SQL));

        // --- fixtures (inserted as `r2m`, the owner — RLS never applies to the owner) ---
        const [userA] = await tx
          .insert(schema.userAccount)
          .values({ primaryEmail: `rls-test-user-a-${Date.now()}@test.local` })
          .returning();
        const [userB] = await tx
          .insert(schema.userAccount)
          .values({ primaryEmail: `rls-test-user-b-${Date.now()}@test.local` })
          .returning();
        if (!userA || !userB) throw new Error("fixture insert failed");

        const [orgA] = await tx
          .insert(schema.organization)
          .values({ name: "RLS Test Org A", slug: `rls-test-org-a-${Date.now()}`, type: "RESEARCH_UNIT", createdByUserId: userA.id })
          .returning();
        const [orgB] = await tx
          .insert(schema.organization)
          .values({ name: "RLS Test Org B", slug: `rls-test-org-b-${Date.now()}`, type: "ENTERPRISE", createdByUserId: userB.id })
          .returning();
        if (!orgA || !orgB) throw new Error("fixture insert failed");

        await tx.insert(schema.organizationMember).values({ organizationId: orgA.id, userId: userA.id, role: "ORG_OWNER", status: "ACTIVE" });
        await tx.insert(schema.organizationMember).values({ organizationId: orgB.id, userId: userB.id, role: "ORG_OWNER", status: "ACTIVE" });

        const [caseA] = await tx
          .insert(schema.technologyCase)
          .values({ owningOrganizationId: orgA.id, title: "RLS Test Case A", slug: `rls-test-case-a-${Date.now()}`, createdByUserId: userA.id })
          .returning();
        const [caseB] = await tx
          .insert(schema.technologyCase)
          .values({ owningOrganizationId: orgB.id, title: "RLS Test Case B", slug: `rls-test-case-b-${Date.now()}`, createdByUserId: userB.id })
          .returning();
        if (!caseA || !caseB) throw new Error("fixture insert failed");

        await tx.insert(schema.caseMember).values({ technologyCaseId: caseA.id, userId: userA.id, organizationId: orgA.id, role: "OWNER", status: "ACTIVE" });
        await tx.insert(schema.caseMember).values({ technologyCaseId: caseB.id, userId: userB.id, organizationId: orgB.id, role: "OWNER", status: "ACTIVE" });

        const [privateResourceB] = await tx
          .insert(schema.resource)
          .values({ ownerOrganizationId: orgB.id, createdByUserId: userB.id, type: "DATASET", title: "RLS Test Private Resource B", accessLevel: "PRIVATE" })
          .returning();
        const [publicResourceB] = await tx
          .insert(schema.resource)
          .values({ ownerOrganizationId: orgB.id, createdByUserId: userB.id, type: "DATASET", title: "RLS Test Public Resource B", accessLevel: "PUBLIC" })
          .returning();
        if (!privateResourceB || !publicResourceB) throw new Error("fixture insert failed");

        const [resourceVersionB] = await tx
          .insert(schema.resourceVersion)
          .values({ resourceId: privateResourceB.id, versionNo: 1, status: "PUBLISHED", createdByUserId: userB.id })
          .returning();
        if (!resourceVersionB) throw new Error("fixture insert failed");

        const [evidenceB] = await tx
          .insert(schema.evidence)
          .values({
            technologyCaseId: caseB.id,
            resourceVersionId: resourceVersionB.id,
            title: "RLS Test Evidence B",
            claim: "test claim",
            relevanceNote: "test relevance",
            createdByUserId: userB.id,
          })
          .returning();
        if (!evidenceB) throw new Error("fixture insert failed");

        const [researchNeedB] = await tx
          .insert(schema.researchNeed)
          .values({ companyOrganizationId: orgB.id, createdByUserId: userB.id, title: "RLS Test Need B", visibility: "PRIVATE" })
          .returning();
        if (!researchNeedB) throw new Error("fixture insert failed");

        // --- switch to the app's runtime role + actor context (userA / orgA) ---
        await tx.execute(sql.raw(`SET LOCAL ROLE r2m_app`));
        await tx.execute(sql.raw(`SET LOCAL app.current_user_id = '${userA.id}'`));
        await tx.execute(sql.raw(`SET LOCAL app.current_org_id = '${orgA.id}'`));

        const caseRowsAsUserA = await tx.select({ id: schema.technologyCase.id }).from(schema.technologyCase).where(
          sql`${schema.technologyCase.id} IN (${caseA.id}, ${caseB.id})`,
        );
        const resourceRowsAsUserA = await tx.select({ id: schema.resource.id }).from(schema.resource).where(
          sql`${schema.resource.id} IN (${privateResourceB.id}, ${publicResourceB.id})`,
        );
        const researchNeedRowsAsUserA = await tx.select({ id: schema.researchNeed.id }).from(schema.researchNeed).where(
          sql`${schema.researchNeed.id} = ${researchNeedB.id}`,
        );
        const evidenceRowsAsUserA = await tx.select({ id: schema.evidence.id }).from(schema.evidence).where(
          sql`${schema.evidence.id} = ${evidenceB.id}`,
        );

        captured = {
          caseRowsAsUserA,
          resourceRowsAsUserA,
          researchNeedRowsAsUserA,
          evidenceRowsAsUserA,
          caseAId: caseA.id,
          caseBId: caseB.id,
          privateResourceBId: privateResourceB.id,
          publicResourceBId: publicResourceB.id,
          researchNeedBId: researchNeedB.id,
          evidenceBId: evidenceB.id,
        };

        throw new ForceRollback("intentional — always roll back, never persist test fixtures or leave RLS enabled");
      }),
    ).rejects.toThrow(ForceRollback);

    if (!captured) throw new Error("transaction never reached the capture point");

    // Own case (A, user A is a member) stays visible; the other org's case (B) does not —
    // proves the policy neither leaks cross-tenant nor blocks the user's own data.
    expect(captured.caseRowsAsUserA.map((r) => r.id)).toEqual([captured.caseAId]);

    // Private resource from org B must be invisible; PUBLIC resource from org B must
    // still be visible — proves the policy's OR-branches are both live, not just "deny all".
    const visibleResourceIds = captured.resourceRowsAsUserA.map((r) => r.id);
    expect(visibleResourceIds).not.toContain(captured.privateResourceBId);
    expect(visibleResourceIds).toContain(captured.publicResourceBId);

    // PRIVATE research_need from org B must be invisible to user A.
    expect(captured.researchNeedRowsAsUserA.map((r) => r.id)).toEqual([]);

    // Evidence on case B (user A not a member of case B) must be invisible.
    expect(captured.evidenceRowsAsUserA.map((r) => r.id)).toEqual([]);
  }, 30000);
});
