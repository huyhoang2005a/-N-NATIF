/**
 * Demo/showcase seed for a live R2M V5 walkthrough. Unlike `run.ts` (minimal 3-user
 * bootstrap seed, runs via `pnpm db:seed`, NOT modified here), this is a standalone,
 * one-shot script driven almost entirely through the real HTTP API (`http://localhost:3000/v1`)
 * so every business invariant (state machines, paired status columns, role checks) is
 * enforced by the exact same service-layer code a real user would go through — not
 * reimplemented here. The only direct-SQL steps are leaf-level, no-cross-table-invariant
 * data: `email_verified_at` (mirrors run.ts's own precedent of setting it directly at
 * insert time), `resource_chunk` content (avoids paying for real Gemini embedding calls —
 * per instructions, AI-pipeline output is inserted as plausible static content instead of
 * triggering the real pipeline), and `author_profile.expertise_tags` (no PATCH endpoint
 * exists for this field anywhere in the API surface).
 *
 * Run with: `pnpm --filter @r2m/database exec tsx src/seeds/demo.ts`
 * Requires: API on :3000, worker running (outbox dispatcher drains recommendation runs +
 * notifications), Postgres/Redis/MinIO/ClamAV containers up.
 *
 * Safe to re-run: every step is wrapped so a failure (e.g. "already exists" from a prior
 * partial run) is logged and skipped rather than aborting the whole script — nothing here
 * does a destructive write, so partial re-runs converge rather than corrupt state.
 */
import path from "node:path";
// Repo root .env is not auto-loaded by `tsx`/pnpm the way `apps/api`'s NestJS bootstrap
// loads it — load it explicitly before any module that calls @r2m/env's loadEnv() (e.g.
// getDb()) runs, otherwise every DB call fails with "Invalid environment configuration".
process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));

import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "../client";
import { authorProfile } from "../schema/author";
import { resourceChunk } from "../schema/resource";
import { userAccount } from "../schema/identity";

const BASE = "http://localhost:3000/v1";
const PASSWORD = "ChangeMe123!";

const MINI_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF",
  "utf-8",
);

// ---------- counters for the final report ----------
const counts: Record<string, number> = {};
const bump = (key: string, n = 1): void => {
  counts[key] = (counts[key] ?? 0) + n;
};
const failures: string[] = [];

// ---------- HTTP helpers ----------
async function api<T = unknown>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; requestId?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.requestId) headers["x-request-id"] = opts.requestId;
  let bodyToSend: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyToSend = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: bodyToSend });
  const text = await res.text();
  const json = text ? safeJson(text) : undefined;
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function apiMultipart<T = unknown>(
  method: string,
  path: string,
  fields: Record<string, string>,
  file: { buffer: Buffer; filename: string; mimeType: string },
  token?: string,
): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([file.buffer], { type: file.mimeType }), file.filename);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: form });
  const text = await res.text();
  const json = text ? safeJson(text) : undefined;
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return json as T;
}

// Login is rate-limited server-side (10 requests / 60s per the `login` RateLimit key) and
// this script logs the same handful of demo accounts back in repeatedly across phases —
// cache tokens per email and retry-with-backoff on 429 instead of hammering the endpoint.
const tokenCache = new Map<string, string>();
async function login(email: string, password = PASSWORD): Promise<string> {
  const cached = tokenCache.get(email);
  if (cached) return cached;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await api<{ accessToken: string }>("POST", "/auth/login", { body: { email, password } });
      tokenCache.set(email, r.accessToken);
      return r.accessToken;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const match = /SYSTEM_RATE_LIMITED.*"retryAfterSeconds":(\d+)/.exec(msg);
      if (match) {
        const waitMs = (Number(match[1]) + 1) * 1000;
        console.warn(`  [login] rate-limited on ${email}, waiting ${waitMs}ms (attempt ${attempt + 1})`);
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`login: exhausted retries for ${email}`);
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const result = await fn();
    console.log(`[ok]   ${label}`);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[skip] ${label} :: ${msg.slice(0, 300)}`);
    failures.push(`${label} :: ${msg.slice(0, 200)}`);
    return undefined;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- direct-DB leaf helpers (documented exceptions, see file header) ----------
async function verifyEmailByEmail(email: string): Promise<void> {
  const db = getDb();
  await db.update(userAccount).set({ emailVerifiedAt: new Date() }).where(eq(userAccount.primaryEmail, email));
}

async function getUserIdByEmail(email: string): Promise<string | undefined> {
  const db = getDb();
  const row = await db.query.userAccount.findFirst({ where: eq(userAccount.primaryEmail, email) });
  return row?.id;
}

// Read-only fallbacks so a re-run after a partial failure converges instead of erroring —
// these are plain SELECTs, no invariant risk, used only when the corresponding API call
// reports the row already exists.
async function findOrgIdByName(name: string): Promise<string | undefined> {
  const db = getDb();
  const result = (await db.execute(sql`select id from organization where name = ${name} limit 1`)) as unknown as {
    rows: { id: string }[];
  };
  return result.rows[0]?.id;
}
async function findMemberByOrgAndUser(organizationId: string, userId: string): Promise<{ id: string; status: string } | undefined> {
  const db = getDb();
  const result = (await db.execute(
    sql`select id, status from organization_member where organization_id = ${organizationId} and user_id = ${userId} limit 1`,
  )) as unknown as { rows: { id: string; status: string }[] };
  return result.rows[0];
}
async function findResourceByTitle(title: string): Promise<{ id: string } | undefined> {
  const db = getDb();
  const result = (await db.execute(sql`select id from resource where title = ${title} limit 1`)) as unknown as {
    rows: { id: string }[];
  };
  return result.rows[0];
}
async function findPublishedVersion(resourceId: string): Promise<{ id: string } | undefined> {
  const db = getDb();
  const result = (await db.execute(
    sql`select id from resource_version where resource_id = ${resourceId} and status = 'PUBLISHED' limit 1`,
  )) as unknown as { rows: { id: string }[] };
  return result.rows[0];
}
async function findCompanyProfileOrgId(organizationId: string): Promise<{ organizationId: string; publicSlug: string } | undefined> {
  const db = getDb();
  const result = (await db.execute(
    sql`select organization_id as "organizationId", public_slug as "publicSlug" from company_profile where organization_id = ${organizationId} limit 1`,
  )) as unknown as { rows: { organizationId: string; publicSlug: string }[] };
  return result.rows[0];
}
async function findResearchNeedByTitle(title: string): Promise<{ id: string } | undefined> {
  const db = getDb();
  const result = (await db.execute(sql`select id from research_need where title = ${title} limit 1`)) as unknown as {
    rows: { id: string }[];
  };
  return result.rows[0];
}

async function setExpertiseTags(userId: string, tags: string[]): Promise<void> {
  const db = getDb();
  await db.update(authorProfile).set({ expertiseTags: tags }).where(eq(authorProfile.userId, userId));
}

async function insertResourceChunk(resourceVersionId: string, content: string, chunkIndex = 0): Promise<void> {
  const db = getDb();
  await db.insert(resourceChunk).values({
    resourceVersionId,
    chunkIndex,
    content,
    tokenCount: Math.ceil(content.length / 4),
  });
}

// ================= MAIN =================
async function main(): Promise<void> {
  console.log("=== R2M demo seed: starting ===");

  // Pre-existing accounts (per run.ts)
  const adminToken = await login("admin@r2m.local");
  const reviewerToken = await login("reviewer@r2m.local");
  const sampleOwnerToken = await login("owner@sample-research-unit.local");
  await api<{ userId: string }>("GET", "/me", { token: sampleOwnerToken });
  const sampleOrgs = await api<{ id: string; slug: string; name: string }[]>("GET", "/organizations", {
    token: sampleOwnerToken,
  });
  const sampleOrg = sampleOrgs.find((o) => o.slug === "sample-research-unit")!;
  console.log(`Reusing sample-research-unit org id=${sampleOrg.id}`);

  // ---------------- PHASE A: Organizations ----------------
  interface OrgSeed {
    key: string;
    organizationName: string;
    organizationType: "RESEARCH_UNIT" | "ENTERPRISE" | "GOVERNMENT";
    ownerEmail: string;
    ownerDisplayName: string;
    website?: string;
    taxCode?: string;
  }
  const orgSeeds: OrgSeed[] = [
    {
      key: "vcnsh",
      organizationName: "Viện Công nghệ Sinh học Việt Nam (Demo)",
      organizationType: "RESEARCH_UNIT",
      ownerEmail: "vien.truong@vcnsh-demo.vn",
      ownerDisplayName: "GS.TS. Đặng Thị Hồng",
      website: "https://vcnsh-demo.vn",
    },
    {
      key: "giaiphapso",
      organizationName: "Công ty CP Giải pháp Số Việt (Demo)",
      organizationType: "ENTERPRISE",
      ownerEmail: "giamdoc@giaiphapso-demo.vn",
      ownerDisplayName: "Nguyễn Minh Tuấn",
      website: "https://giaiphapso-demo.vn",
      taxCode: "0109876543",
    },
    {
      key: "skhcn",
      organizationName: "Sở Khoa học và Công nghệ TP.HCM (Demo)",
      organizationType: "GOVERNMENT",
      ownerEmail: "pgd@skhcn-hcm-demo.gov.vn",
      ownerDisplayName: "Trần Quốc Bảo",
    },
    {
      key: "dut",
      organizationName: "Đại học Bách Khoa Đà Nẵng (Demo)",
      organizationType: "RESEARCH_UNIT",
      ownerEmail: "hieutruong@dut-demo.edu.vn",
      ownerDisplayName: "PGS.TS. Lê Văn Sơn",
      website: "https://dut-demo.edu.vn",
    },
    {
      key: "abc",
      organizationName: "Tập đoàn Công nghệ ABC Innovation (Demo)",
      organizationType: "ENTERPRISE",
      ownerEmail: "ceo@abc-innovation-demo.vn",
      ownerDisplayName: "Phạm Thị Ngọc Anh",
      website: "https://abc-innovation-demo.vn",
      taxCode: "0312345678",
    },
  ];

  const orgIds: Record<string, string> = {};
  for (const seed of orgSeeds) {
    const org = await step(`register org ${seed.organizationName}`, () =>
      apiMultipart<{ id: string; slug: string }>(
        "POST",
        "/organizations/register",
        {
          organizationName: seed.organizationName,
          organizationType: seed.organizationType,
          ownerEmail: seed.ownerEmail,
          ownerPassword: PASSWORD,
          ownerDisplayName: seed.ownerDisplayName,
          documentType: "ORGANIZATION_LETTER",
          ...(seed.website ? { website: seed.website } : {}),
          ...(seed.taxCode ? { taxCode: seed.taxCode } : {}),
        },
        { buffer: MINI_PDF, filename: "org-letter.pdf", mimeType: "application/pdf" },
      ),
    );
    if (org) {
      orgIds[seed.key] = org.id;
      bump("organizations");
    } else {
      // Idempotent fallback: a prior partial run may have already created this org (API
      // reported ORG_ALREADY_EXISTS / AUTH_EMAIL_ALREADY_REGISTERED) — resolve its id via
      // a plain read instead of failing every downstream step that needs it.
      const existingId = await step(`fallback lookup: org ${seed.organizationName}`, () => findOrgIdByName(seed.organizationName));
      if (existingId) orgIds[seed.key] = existingId;
    }
    await step(`verify email ${seed.ownerEmail}`, () => verifyEmailByEmail(seed.ownerEmail));
  }

  // Verification decisions: vcnsh + giaiphapso -> APPROVED/ACTIVE; skhcn -> claimed only
  // (IN_REVIEW); dut + abc left untouched (PENDING).
  async function claimAndDecideOrgVerification(orgId: string, decision: "APPROVE" | "REJECT", note?: string): Promise<void> {
    const pending = await api<{ id: string; organizationId: string; status: string }[]>(
      "GET",
      "/platform/organization-verifications",
      { token: reviewerToken },
    );
    const req = pending.find((r) => r.organizationId === orgId && r.status === "PENDING");
    if (!req) throw new Error(`no PENDING org-verification-request found for org ${orgId}`);
    await api("POST", `/platform/organization-verifications/${req.id}/claim`, { token: reviewerToken });
    await api("POST", `/platform/organization-verifications/${req.id}/decision`, {
      token: reviewerToken,
      body: { decision, reviewerNote: note },
    });
  }
  async function claimOnlyOrgVerification(orgId: string): Promise<void> {
    const pending = await api<{ id: string; organizationId: string; status: string }[]>(
      "GET",
      "/platform/organization-verifications",
      { token: reviewerToken },
    );
    const req = pending.find((r) => r.organizationId === orgId && r.status === "PENDING");
    if (!req) throw new Error(`no PENDING org-verification-request found for org ${orgId}`);
    await api("POST", `/platform/organization-verifications/${req.id}/claim`, { token: reviewerToken });
  }

  if (orgIds.vcnsh) {
    await step("approve org verification: Viện CNSH", () =>
      claimAndDecideOrgVerification(orgIds.vcnsh!, "APPROVE", "Hồ sơ hợp lệ, đủ giấy tờ pháp lý."),
    );
    bump("org_verification_decisions");
  }
  if (orgIds.giaiphapso) {
    await step("approve org verification: Giải pháp Số", () =>
      claimAndDecideOrgVerification(orgIds.giaiphapso!, "APPROVE", "Đã xác minh mã số thuế, phê duyệt."),
    );
    bump("org_verification_decisions");
  }
  if (orgIds.skhcn) {
    await step("claim (in-review) org verification: Sở KHCN", () => claimOnlyOrgVerification(orgIds.skhcn!));
    bump("org_verification_in_review");
  }
  // dut, abc: left PENDING deliberately for state variety.

  // ---------------- PHASE B: additional members (join-request + owner approval) ----------------
  interface MemberSeed {
    orgKey: string;
    orgId: string;
    ownerToken: string;
    displayName: string;
    email: string;
    approve: boolean;
  }
  const memberSeeds: MemberSeed[] = [
    { orgKey: "sample", orgId: sampleOrg.id, ownerToken: sampleOwnerToken, displayName: "Lê Thị Hương", email: "author.le@sample-research-unit-demo.local", approve: true },
    { orgKey: "sample", orgId: sampleOrg.id, ownerToken: sampleOwnerToken, displayName: "Phạm Văn Đức", email: "author.pham@sample-research-unit-demo.local", approve: true },
  ];
  if (orgIds.vcnsh) {
    const vcnshOwnerToken = await login("vien.truong@vcnsh-demo.vn");
    memberSeeds.push(
      { orgKey: "vcnsh", orgId: orgIds.vcnsh, ownerToken: vcnshOwnerToken, displayName: "TS. Nguyễn Thị Lan", email: "ts.nguyen@vcnsh-demo.vn", approve: true },
      { orgKey: "vcnsh", orgId: orgIds.vcnsh, ownerToken: vcnshOwnerToken, displayName: "ThS. Trần Văn Minh", email: "ds.tran@vcnsh-demo.vn", approve: true },
    );
  }
  if (orgIds.giaiphapso) {
    const giaiphapsoOwnerToken = await login("giamdoc@giaiphapso-demo.vn");
    memberSeeds.push({
      orgKey: "giaiphapso",
      orgId: orgIds.giaiphapso,
      ownerToken: giaiphapsoOwnerToken,
      displayName: "Hoàng Thị Mai",
      email: "bd.hoang@giaiphapso-demo.vn",
      approve: false, // left PENDING_APPROVAL deliberately for member-management state variety
    });
  }

  const memberUserIds: Record<string, string> = {};
  for (const m of memberSeeds) {
    let memberId: string | undefined;
    let userId: string | undefined;
    let alreadyActive = false;
    const created = await step(`join-request ${m.email} -> ${m.orgKey}`, () =>
      api<{ id: string; userId: string }>("POST", `/organizations/${m.orgId}/join-requests`, {
        body: { displayName: m.displayName, email: m.email, password: PASSWORD },
      }),
    );
    if (created) {
      memberId = created.id;
      userId = created.userId;
      bump("join_requests");
    } else {
      // Idempotent fallback: prior partial run already created this account/membership.
      userId = await getUserIdByEmail(m.email);
      if (userId) {
        const existingMember = await findMemberByOrgAndUser(m.orgId, userId);
        memberId = existingMember?.id;
        alreadyActive = existingMember?.status === "ACTIVE";
      }
    }
    if (!userId || !memberId) continue;
    memberUserIds[m.email] = userId;
    await step(`verify email ${m.email}`, () => verifyEmailByEmail(m.email));
    if (m.approve && !alreadyActive) {
      await step(`approve membership ${m.email}`, () =>
        api("PATCH", `/organizations/${m.orgId}/members/${memberId}`, {
          token: m.ownerToken,
          body: { status: "ACTIVE" },
        }),
      );
      bump("memberships_approved");
    } else if (!m.approve) {
      bump("memberships_pending_approval");
    }
  }

  // ---------------- PHASE C: Author verification ----------------
  async function submitAuthorVerification(email: string, affiliationOrgId: string): Promise<string | undefined> {
    const token = await login(email);
    const upload = await api<{ uploadUrl: string; storageObjectKey: string }>("POST", "/author-verifications/uploads", {
      token,
      body: { documentType: "IDENTITY_DOCUMENT", originalFilename: "cccd.pdf", mimeType: "application/pdf", sizeBytes: MINI_PDF.length },
    });
    const putRes = await fetch(upload.uploadUrl, { method: "PUT", body: MINI_PDF, headers: { "Content-Type": "application/pdf" } });
    if (!putRes.ok) throw new Error(`PUT to presigned URL failed: ${putRes.status}`);
    const submitted = await api<{ id: string }>("POST", "/author-verifications", {
      token,
      body: {
        affiliationOrgId,
        submittedNote: "Đề nghị xác minh tác giả để đăng tài nguyên nghiên cứu trên nền tảng R2M.",
        documentStorageObjectKey: upload.storageObjectKey,
        documentType: "IDENTITY_DOCUMENT",
        originalFilename: "cccd.pdf",
        mimeType: "application/pdf",
        sizeBytes: MINI_PDF.length,
      },
    });
    return submitted.id;
  }
  async function claimAndDecideAuthorVerification(requestId: string, decision: "APPROVE" | "REJECT", note?: string): Promise<void> {
    await api("POST", `/platform/author-verifications/${requestId}/claim`, { token: reviewerToken });
    await api("POST", `/platform/author-verifications/${requestId}/decision`, {
      token: reviewerToken,
      body: { decision, reviewerNote: note },
    });
  }
  async function claimOnlyAuthorVerification(requestId: string): Promise<void> {
    await api("POST", `/platform/author-verifications/${requestId}/claim`, { token: reviewerToken });
  }

  const authorLeEmail = "author.le@sample-research-unit-demo.local";
  const authorPhamEmail = "author.pham@sample-research-unit-demo.local";
  const tsNguyenEmail = "ts.nguyen@vcnsh-demo.vn";
  const dsTranEmail = "ds.tran@vcnsh-demo.vn";

  if (memberUserIds[authorLeEmail]) {
    const reqId = await step(`submit author-verification: Lê Thị Hương`, () => submitAuthorVerification(authorLeEmail, sampleOrg.id));
    if (reqId) {
      bump("author_verification_requests");
      await step("approve author-verification: Lê Thị Hương -> VERIFIED", () =>
        claimAndDecideAuthorVerification(reqId, "APPROVE", "Xác minh qua CCCD và email tổ chức, phê duyệt."),
      );
    }
  }
  if (memberUserIds[authorPhamEmail]) {
    const reqId = await step(`submit author-verification: Phạm Văn Đức (left PENDING)`, () =>
      submitAuthorVerification(authorPhamEmail, sampleOrg.id),
    );
    if (reqId) bump("author_verification_requests");
    // deliberately left unclaimed -> PENDING/PENDING pairing
  }
  if (orgIds.vcnsh && memberUserIds[tsNguyenEmail]) {
    const reqId = await step(`submit author-verification: TS. Nguyễn Thị Lan`, () =>
      submitAuthorVerification(tsNguyenEmail, orgIds.vcnsh!),
    );
    if (reqId) {
      bump("author_verification_requests");
      await step("approve author-verification: TS. Nguyễn Thị Lan -> VERIFIED", () =>
        claimAndDecideAuthorVerification(reqId, "APPROVE", "Xác minh học hàm/học vị qua văn bản viện, phê duyệt."),
      );
    }
  }
  if (orgIds.vcnsh && memberUserIds[dsTranEmail]) {
    const reqId = await step(`submit author-verification: ThS. Trần Văn Minh (left IN_REVIEW)`, () =>
      submitAuthorVerification(dsTranEmail, orgIds.vcnsh!),
    );
    if (reqId) {
      bump("author_verification_requests");
      await step("claim (in-review) author-verification: ThS. Trần Văn Minh", () => claimOnlyAuthorVerification(reqId));
      bump("author_verification_in_review");
    }
  }

  // Spot-check the exact pairing this task called out as previously-buggy.
  await step("spot-check author_profile <-> author_verification_request pairing", async () => {
    const db = getDb();
    const result = (await db.execute(sql`
      select avr.status as req_status, ap.verification_status as profile_status, avr.author_user_id
      from author_verification_request avr
      join author_profile ap on ap.user_id = avr.author_user_id
      where avr.submitted_at > now() - interval '1 hour'
    `)) as unknown as { rows: unknown[] };
    console.log("  pairing check rows:", JSON.stringify(result.rows));
  });

  // expertise tags (no PATCH endpoint exists for this field -> documented direct-SQL leaf write)
  if (memberUserIds[tsNguyenEmail]) {
    await step("set expertise tags: TS. Nguyễn Thị Lan", () =>
      setExpertiseTags(memberUserIds[tsNguyenEmail]!, ["Công nghệ sinh học", "Vi sinh vật học", "Lên men công nghiệp"]),
    );
  }
  if (memberUserIds[authorLeEmail]) {
    await step("set expertise tags: Lê Thị Hương", () =>
      setExpertiseTags(memberUserIds[authorLeEmail]!, ["Thị giác máy tính", "Robot công nghiệp", "IoT"]),
    );
  }

  console.log("=== Phase A-C done. Counts so far:", JSON.stringify(counts));

  // ---------------- PHASE D: Resources & versions ----------------
  const leToken = memberUserIds[authorLeEmail] ? await login(authorLeEmail) : sampleOwnerToken;
  const phamToken = memberUserIds[authorPhamEmail] ? await login(authorPhamEmail) : sampleOwnerToken;
  const nguyenToken = orgIds.vcnsh && memberUserIds[tsNguyenEmail] ? await login(tsNguyenEmail) : undefined;
  if (orgIds.vcnsh && memberUserIds[dsTranEmail]) await login(dsTranEmail);
  const vcnshOwnerToken = orgIds.vcnsh ? await login("vien.truong@vcnsh-demo.vn") : undefined;

  // Live-discovered invariant: `POST /resources` (register) allows an active member who is
  // ALSO a verified author (RESOURCE_AUTHOR_NOT_VERIFIED otherwise) — but managing a
  // resource afterwards (creating/publishing a version) requires ORG_OWNER/ORG_ADMIN
  // specifically (`assertCanManageResource`, packages/authz/src/resource.policy.ts), not
  // just any active member. So registration uses the author's token (realistic
  // `createdByUserId` attribution) while version create/publish uses the org owner's token.
  async function publishWithRetry(token: string, versionId: string): Promise<void> {
    // The outbox-dispatcher's poll loop has been observed taking well over 10s to pick up
    // a ResourceIngestionQueued event under load (several demo resources created in quick
    // succession) — generous window (up to ~60s) rather than a tight one.
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await api("POST", `/resource-versions/${versionId}/publish`, { token });
        return;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("RESOURCE_VERSION_NOT_SCANNED") && attempt < maxAttempts - 1) {
          await sleep(3000);
          continue;
        }
        throw error;
      }
    }
  }

  interface ResourceSeed {
    key: string;
    ownerOrgId: string;
    creatorToken: string;
    managerToken: string;
    type: string;
    title: string;
    description: string;
    accessLevel: string;
    extra?: Record<string, string>;
    chunkContent?: string;
  }
  const resourceSeeds: ResourceSeed[] = [
    {
      key: "r_iot",
      ownerOrgId: sampleOrg.id,
      creatorToken: sampleOwnerToken,
      managerToken: sampleOwnerToken,
      type: "DATASET",
      title: "Bộ dữ liệu cảm biến IoT giám sát chất lượng nước nuôi trồng thủy sản",
      description: "Dữ liệu thời gian thực từ cảm biến IoT đo pH, oxy hòa tan, nhiệt độ tại các ao nuôi tôm thẻ chân trắng, thu thập trong 18 tháng tại Bạc Liêu.",
      accessLevel: "PUBLIC",
      chunkContent:
        "Bộ dữ liệu cảm biến IoT giám sát chất lượng nước nuôi trồng thủy sản gồm các chỉ số pH, oxy hòa tan, nhiệt độ, độ mặn thu thập theo thời gian thực tại ao nuôi tôm. Hệ thống IoT cảnh báo sớm khi chất lượng nước vượt ngưỡng an toàn, hỗ trợ người nuôi trồng thủy sản ra quyết định kịp thời.",
    },
    {
      key: "r_robot",
      ownerOrgId: sampleOrg.id,
      creatorToken: leToken,
      managerToken: sampleOwnerToken,
      type: "SOURCE_CODE",
      title: "Mã nguồn hệ thống điều khiển robot hàn tự động ứng dụng thị giác máy tính",
      description: "Mã nguồn hệ thống điều khiển robot hàn 6 bậc tự do, tích hợp camera và mô hình thị giác máy tính để phát hiện khuyết tật mối hàn theo thời gian thực.",
      accessLevel: "PUBLIC",
      chunkContent:
        "Hệ thống điều khiển robot hàn tự động ứng dụng thị giác máy tính để kiểm tra khuyết tật mối hàn trong dây chuyền sản xuất ô tô. Camera công nghiệp kết hợp mô hình học sâu phát hiện lỗi mối hàn theo thời gian thực, giảm tỷ lệ lỗi và tăng năng suất robot hàn.",
    },
    {
      // Live-discovered: resource registration requires the creator to be a VERIFIED
      // author (RESOURCE_AUTHOR_NOT_VERIFIED otherwise) — Phạm Văn Đức's author
      // verification was deliberately left PENDING for state variety, so this resource is
      // registered by the org owner instead (still a legitimate real-world case: not every
      // uploaded resource is authored by a verified researcher).
      key: "r_pin",
      ownerOrgId: sampleOrg.id,
      creatorToken: sampleOwnerToken,
      managerToken: sampleOwnerToken,
      type: "REPORT",
      title: "Báo cáo thử nghiệm pin lithium-ion thể rắn thế hệ mới",
      description: "Báo cáo kết quả thử nghiệm độ bền chu kỳ sạc/xả và mật độ năng lượng của pin lithium-ion thể rắn trong điều kiện phòng thí nghiệm.",
      accessLevel: "ORGANIZATION",
    },
    {
      key: "r_vitao",
      ownerOrgId: orgIds.vcnsh ?? sampleOrg.id,
      creatorToken: nguyenToken ?? sampleOwnerToken,
      managerToken: vcnshOwnerToken ?? sampleOwnerToken,
      type: "PAPER",
      title: "Quy trình lên men sinh khối vi tảo Spirulina quy mô pilot",
      description: "Nghiên cứu tối ưu hóa quy trình lên men sinh khối vi tảo Spirulina platensis ở quy mô pilot 500L, ứng dụng làm nguyên liệu thực phẩm chức năng.",
      accessLevel: "PUBLIC",
      extra: {
        doi: "10.9999/vcnsh.2026.001",
        abstract: "Nghiên cứu quy trình lên men sinh khối vi tảo Spirulina platensis quy mô pilot, khảo sát ảnh hưởng của ánh sáng, CO2 và dinh dưỡng đến năng suất sinh khối.",
        publisher: "Viện Công nghệ Sinh học Việt Nam",
        venue: "Tạp chí Công nghệ Sinh học Việt Nam",
        publicationDate: "2026-03-15",
        language: "vi",
      },
      chunkContent:
        "Quy trình lên men sinh khối vi tảo Spirulina quy mô pilot khảo sát điều kiện ánh sáng, nồng độ CO2 và môi trường dinh dưỡng tối ưu. Vi tảo Spirulina platensis được nuôi cấy trong bể lên men 500 lít, đạt năng suất sinh khối cao, ứng dụng làm nguyên liệu thực phẩm chức năng và thức ăn chăn nuôi.",
    },
    {
      // Live-discovered: ThS. Trần Văn Minh's author verification was deliberately left
      // IN_REVIEW (not yet VERIFIED) for state variety, so this resource is registered by
      // the org owner instead — same rationale as r_pin above.
      // Live-discovered: an ORG_OWNER who has no `author_profile` row at all is ALSO
      // rejected by RESOURCE_AUTHOR_NOT_VERIFIED (the earlier r_iot/r_pin successes with
      // sampleOwnerToken only worked because that pre-existing seed account happens to
      // already have a legacy VERIFIED author_profile from an earlier session) — use a
      // genuinely verified author instead.
      key: "r_vacxin",
      ownerOrgId: orgIds.vcnsh ?? sampleOrg.id,
      creatorToken: nguyenToken ?? sampleOwnerToken,
      managerToken: vcnshOwnerToken ?? sampleOwnerToken,
      type: "EXPERIMENT_RESULT",
      title: "Kết quả thử nghiệm vắc-xin tái tổ hợp phòng bệnh trên tôm thẻ chân trắng",
      description: "Dữ liệu thử nghiệm hiệu lực vắc-xin tái tổ hợp phòng bệnh hoại tử gan tụy cấp trên tôm thẻ chân trắng, thử nghiệm trên 12 bể nuôi đối chứng.",
      accessLevel: "PUBLIC",
    },
    {
      key: "r_collagen",
      ownerOrgId: orgIds.vcnsh ?? sampleOrg.id,
      creatorToken: nguyenToken ?? sampleOwnerToken,
      managerToken: vcnshOwnerToken ?? sampleOwnerToken,
      type: "PATENT",
      title: "Bằng sáng chế quy trình chiết xuất collagen từ da cá tra",
      description: "Quy trình công nghệ chiết xuất và tinh chế collagen y sinh từ phụ phẩm da cá tra, ứng dụng trong mỹ phẩm và dược phẩm.",
      accessLevel: "PUBLIC",
      chunkContent:
        "Bằng sáng chế quy trình chiết xuất collagen từ da cá tra sử dụng công nghệ enzyme thủy phân có kiểm soát. Collagen thu được có độ tinh khiết cao, ứng dụng trong sản xuất mỹ phẩm, thực phẩm chức năng và vật liệu y sinh, tận dụng phụ phẩm chế biến cá tra.",
    },
  ];

  interface ResourceResult {
    id: string;
    versionId: string;
  }
  const resources: Record<string, ResourceResult> = {};

  for (const rs of resourceSeeds) {
    let resourceId: string | undefined;
    const created = await step(`create resource: ${rs.title}`, () =>
      api<{ id: string }>("POST", "/resources", {
        token: rs.creatorToken,
        body: {
          ownerOrganizationId: rs.ownerOrgId,
          type: rs.type,
          title: rs.title,
          description: rs.description,
          accessLevel: rs.accessLevel,
          sourceUrl: `https://r2m-demo-storage.example.org/resources/${rs.key}`,
          ...(rs.extra ?? {}),
        },
      }),
    );
    if (created) {
      resourceId = created.id;
      bump("resources");
    } else {
      const existing = await step(`fallback lookup: resource ${rs.title}`, () => findResourceByTitle(rs.title));
      resourceId = existing?.id;
    }
    if (!resourceId) continue;

    let versionId: string | undefined;
    const existingVersion = await findPublishedVersion(resourceId);
    if (existingVersion) {
      versionId = existingVersion.id;
    } else {
      // Live-discovered bug: `POST /resources` (register) auto-creates version #1 AND
      // correctly appends the `ResourceIngestionQueued` outbox event (resources.service.ts
      // ~line 215-218) — but the separate `POST /resources/:id/versions` (createVersion,
      // for a 2nd+ version) creates the ingestion_job row without ever appending that
      // event (no `outboxService.append` call anywhere in that method), so any additional
      // version's scan stays QUEUED forever and can never be published. Not fixed here
      // (out of scope for a data-seed script) — worked around by publishing the
      // auto-created v1 from register() instead of calling createVersion() at all.
      const existingVersions = await step(`list versions for ${rs.key}`, () =>
        api<{ id: string; status: string; versionNo: number }[]>("GET", `/resources/${resourceId}/versions`, { token: rs.creatorToken }),
      );
      // versionNo 1 specifically: it's the one register() auto-created (working outbox
      // event) — any higher versionNo here is a leftover from the buggy createVersion()
      // path above and would never scan-complete.
      const draftV1 = existingVersions?.filter((v) => v.status === "DRAFT").sort((a, b) => a.versionNo - b.versionNo)[0];
      if (draftV1) {
        await step(`publish auto-created v1 for ${rs.key}`, () => publishWithRetry(rs.managerToken, draftV1.id));
        versionId = draftV1.id;
      }
    }
    if (!versionId) continue;
    bump("resource_versions");
    resources[rs.key] = { id: resourceId, versionId };

    if (rs.chunkContent) {
      const db = getDb();
      const existingChunk = (await db.execute(
        sql`select id from resource_chunk where resource_version_id = ${versionId} limit 1`,
      )) as unknown as { rows: { id: string }[] };
      if (!existingChunk.rows[0]) {
        await step(`insert resource_chunk for ${rs.key} (skips paid Gemini embedding call)`, () =>
          insertResourceChunk(versionId!, rs.chunkContent!),
        );
        bump("resource_chunks_seeded");
      }
    }
  }

  // Community layer: votes + saves + 1 annotation
  const voteTargets: { resourceKey: string; token: string }[] = [
    { resourceKey: "r_vitao", token: adminToken },
    { resourceKey: "r_iot", token: reviewerToken },
    { resourceKey: "r_robot", token: sampleOwnerToken },
    { resourceKey: "r_iot", token: leToken },
    { resourceKey: "r_vitao", token: phamToken },
  ];
  if (nguyenToken) voteTargets.push({ resourceKey: "r_iot", token: nguyenToken });
  for (const vt of voteTargets) {
    const res = resources[vt.resourceKey];
    if (!res) continue;
    const ok = await step(`vote resource ${vt.resourceKey}`, () =>
      api("POST", `/resources/${res.id}/votes`, { token: vt.token }),
    );
    if (ok !== undefined) bump("content_votes");
  }
  const saveTargets: { resourceKey: string; token: string }[] = [
    { resourceKey: "r_vitao", token: leToken },
    { resourceKey: "r_robot", token: sampleOwnerToken },
  ];
  if (nguyenToken) saveTargets.push({ resourceKey: "r_collagen", token: nguyenToken });
  for (const st of saveTargets) {
    const res = resources[st.resourceKey];
    if (!res) continue;
    const ok = await step(`save resource ${st.resourceKey}`, () => api("POST", `/resources/${res.id}/saves`, { token: st.token }));
    if (ok !== undefined) bump("content_saves");
  }
  if (resources.r_robot) {
    await step("annotate r_robot version", () =>
      api("POST", `/resource-versions/${resources.r_robot!.versionId}/annotations`, {
        token: sampleOwnerToken,
        body: {
          content: "Đoạn mô tả thuật toán phát hiện khuyết tật cần dẫn thêm tham chiếu tới bộ dữ liệu huấn luyện gốc.",
          targetSnippet: "mô hình thị giác máy tính để phát hiện khuyết tật mối hàn",
        },
      }),
    );
    bump("annotations");
  }

  console.log("=== Phase D done. Counts so far:", JSON.stringify(counts));

  // ---------------- PHASE E: Technology Cases, Evidence, Assessment, Gap, Roadmap, Transfer ----------------
  // There is no "list frameworks" endpoint in the API, so the ACTIVE framework id is
  // looked up directly (read-only, no invariant at risk).
  const activeFrameworkId = await step("look up ACTIVE assessment framework id", async () => {
    const db = getDb();
    const result = (await db.execute(
      sql`select id from assessment_framework where status = 'ACTIVE' order by version_no desc limit 1`,
    )) as unknown as { rows: { id: string }[] };
    const id = result.rows[0]?.id;
    if (!id) throw new Error("no ACTIVE assessment framework found");
    return id;
  });
  const criteria = activeFrameworkId
    ? await step("list assessment criteria", () =>
        api<{ id: string; requiresEvidence: boolean; requiresCitation: boolean; minScore: number; maxScore: number }[]>(
          "GET",
          `/assessment-frameworks/${activeFrameworkId}/criteria`,
          { token: sampleOwnerToken },
        ),
      )
    : undefined;

  // Idempotency guard: Phase E has many sequential dependent steps (evidence -> assessment
  // -> gaps -> roadmap -> transfer) — rather than guard every single one, skip the whole
  // case block if a case with this exact title already exists from a prior run.
  async function caseExists(title: string): Promise<boolean> {
    const db = getDb();
    const result = (await db.execute(sql`select id from technology_case where title = ${title} limit 1`)) as unknown as {
      rows: { id: string }[];
    };
    return result.rows.length > 0;
  }
  async function createCase(token: string, owningOrganizationId: string, title: string, description: string, summary: string) {
    return api<{ id: string }>("POST", "/technology-cases", { token, body: { owningOrganizationId, title, description, summary } });
  }
  async function addEvidence(token: string, caseId: string, resourceVersionId: string, title: string, claim: string, relevanceNote: string, snippet: string) {
    return api<{ id: string }>("POST", `/technology-cases/${caseId}/evidence`, {
      token,
      body: { resourceVersionId, title, claim, relevanceNote, citation: { snippet } },
    });
  }
  async function transitionCase(token: string, caseId: string, toStatus: string) {
    return api("POST", `/technology-cases/${caseId}/transitions`, { token, body: { toStatus } });
  }

  // Case A: full happy path (Sample RU, created by Lê Thị Hương -> reviewed by Nguyễn Thị Lan)
  const CASE_A_TITLE = "Ứng dụng AI thị giác máy tính kiểm tra khuyết tật mối hàn trong sản xuất ô tô";
  let caseA: { id: string } | undefined;
  if (resources.r_robot && resources.r_iot && !(await caseExists(CASE_A_TITLE))) {
    caseA = await step("create Case A (full pipeline)", () =>
      createCase(
        leToken,
        sampleOrg.id,
        "Ứng dụng AI thị giác máy tính kiểm tra khuyết tật mối hàn trong sản xuất ô tô",
        "Triển khai hệ thống robot hàn tích hợp thị giác máy tính để tự động phát hiện khuyết tật mối hàn trên dây chuyền lắp ráp ô tô, giảm tỷ lệ lỗi và chi phí kiểm tra thủ công.",
        "Robot hàn tự động + AI kiểm tra khuyết tật mối hàn",
      ),
    );
  }
  if (caseA) {
    bump("technology_cases");
    const evA1 = await step("Case A: add evidence #1", () =>
      addEvidence(leToken, caseA!.id, resources.r_robot!.versionId, "Mã nguồn hệ thống điều khiển robot hàn", "Mã nguồn chứng minh khả năng tích hợp thị giác máy tính vào vòng điều khiển robot hàn thời gian thực.", "Là nền tảng kỹ thuật lõi cho case này.", "mô hình thị giác máy tính để phát hiện khuyết tật mối hàn"),
    );
    const evA2 = await step("Case A: add evidence #2", () =>
      addEvidence(leToken, caseA!.id, resources.r_iot!.versionId, "Dữ liệu cảm biến IoT tham chiếu", "Minh họa năng lực thu thập dữ liệu cảm biến thời gian thực có thể tái sử dụng cho giám sát dây chuyền hàn.", "Tham chiếu năng lực hạ tầng IoT sẵn có của đơn vị.", "Hệ thống IoT cảnh báo sớm khi chất lượng nước vượt ngưỡng an toàn"),
    );
    bump("evidence", 2);
    const caseAEvidenceIds = [evA1?.id, evA2?.id].filter((x): x is string => Boolean(x));
    // Adding the case's first evidence auto-transitions DRAFT -> EVIDENCE_COLLECTION
    // server-side (§8 spec business rule) — an explicit transition call to the same
    // status is redundant (CASE_INVALID_TRANSITION) and expected to no-op/skip here.
    await step("Case A: transition -> EVIDENCE_COLLECTION (expected no-op, already auto-transitioned)", () =>
      transitionCase(leToken, caseA!.id, "EVIDENCE_COLLECTION"),
    );

    if (memberUserIds[tsNguyenEmail]) {
      await step("Case A: add TS. Nguyễn Thị Lan as CASE_REVIEWER", () =>
        api("POST", `/technology-cases/${caseA!.id}/members`, {
          token: leToken,
          body: { userId: memberUserIds[tsNguyenEmail], organizationId: orgIds.vcnsh, role: "CASE_REVIEWER" },
        }),
      );
    }

    const assessmentA = await step("Case A: create assessment", () =>
      api<{ id: string }>("POST", `/technology-cases/${caseA!.id}/assessments`, { token: leToken, body: {} }),
    );
    if (assessmentA && criteria) {
      bump("assessments");
      for (const c of criteria) {
        const mid = Math.round((c.minScore + c.maxScore) / 2);
        await step(`Case A: score criterion ${c.id}`, () =>
          api("PUT", `/assessments/${assessmentA.id}/scores/${c.id}`, {
            token: leToken,
            body: {
              score: mid,
              rationale: "Đánh giá dựa trên bằng chứng kỹ thuật đã đính kèm case, mức độ sẵn sàng ở giai đoạn thử nghiệm thực địa.",
              evidenceIds: caseAEvidenceIds,
            },
          }),
        );
      }
      await step("Case A: submit assessment", () => api("POST", `/assessments/${assessmentA.id}/submit`, { token: leToken }));
      if (nguyenToken) {
        await step("Case A: reviewer approves assessment", () =>
          api("POST", `/assessments/${assessmentA.id}/decision`, { token: nguyenToken, body: { decision: "APPROVE" } }),
        );
        await step("Case A: transition -> UNDER_ASSESSMENT", () => transitionCase(leToken, caseA!.id, "UNDER_ASSESSMENT"));

        const gap1 = await step("Case A: create gap #1 (HIGH, from assessment)", () =>
          api<{ id: string }>("POST", `/technology-cases/${caseA!.id}/gaps`, {
            token: leToken,
            body: {
              title: "Chưa có dữ liệu kiểm định độ chính xác mô hình trên môi trường ánh sáng công nghiệp thực tế",
              description: "Mô hình mới chỉ được huấn luyện và kiểm thử trong điều kiện phòng thí nghiệm, cần bổ sung dữ liệu thực địa tại nhà máy.",
              severity: "HIGH",
              category: "Kỹ thuật",
              sourceAssessmentId: assessmentA.id,
            },
          }),
        );
        const gap2 = await step("Case A: create gap #2 (MEDIUM)", () =>
          api<{ id: string }>("POST", `/technology-cases/${caseA!.id}/gaps`, {
            token: leToken,
            body: {
              title: "Chưa có quy trình bảo trì định kỳ cho cụm camera công nghiệp",
              description: "Cần xây dựng quy trình vệ sinh/hiệu chuẩn camera định kỳ để duy trì độ chính xác phát hiện lỗi theo thời gian.",
              severity: "MEDIUM",
              category: "Vận hành",
              sourceAssessmentId: assessmentA.id,
            },
          }),
        );
        if (gap1) {
          bump("gaps");
          await step("Case A: transition -> GAP_IDENTIFIED", () => transitionCase(leToken, caseA!.id, "GAP_IDENTIFIED"));
          await step("Case A: gap #1 -> IN_PROGRESS", () =>
            api("POST", `/gaps/${gap1.id}/transition`, { token: leToken, body: { toStatus: "IN_PROGRESS" } }),
          );
          await step("Case A: gap #1 -> RESOLVED", () =>
            api("POST", `/gaps/${gap1.id}/transition`, {
              token: leToken,
              body: { toStatus: "RESOLVED", resolutionNote: "Đã bổ sung 500 ảnh thực địa từ nhà máy, độ chính xác đạt 96.2%." },
            }),
          );
        }
        if (gap2) bump("gaps");
        // gap2 left OPEN deliberately (MEDIUM, doesn't block roadmap approval gate).

        const roadmapA = await step("Case A: create roadmap", () =>
          api<{ id: string }>("POST", `/technology-cases/${caseA!.id}/roadmaps`, {
            token: leToken,
            body: { title: "Lộ trình triển khai pilot tại nhà máy lắp ráp", objective: "Triển khai thử nghiệm hệ thống tại 1 dây chuyền thực tế trong 6 tháng, tiến tới nhân rộng." },
          }),
        );
        if (roadmapA) {
          bump("roadmaps");
          await step("Case A: transition -> ROADMAP_DRAFT", () => transitionCase(leToken, caseA!.id, "ROADMAP_DRAFT"));
          const m1 = await step("Case A: milestone #1", () =>
            api<{ id: string }>("POST", `/roadmaps/${roadmapA.id}/milestones`, {
              token: leToken,
              body: { title: "Lắp đặt và hiệu chuẩn phần cứng tại nhà máy", priority: "HIGH", startDate: "2026-09-01", dueDate: "2026-10-15" },
            }),
          );
          const m2 = await step("Case A: milestone #2", () =>
            api<{ id: string }>("POST", `/roadmaps/${roadmapA.id}/milestones`, {
              token: leToken,
              body: { title: "Chạy thử nghiệm pilot và thu thập dữ liệu thực địa", priority: "HIGH", startDate: "2026-10-16", dueDate: "2027-01-15" },
            }),
          );
          if (m1) {
            bump("roadmap_milestones");
            await step("Case A: task under milestone #1", () =>
              api("POST", `/milestones/${m1.id}/tasks`, { token: leToken, body: { title: "Lắp đặt cụm camera công nghiệp", priority: "HIGH" } }),
            );
            bump("roadmap_tasks");
            if (gap2) {
              await step("Case A: link gap #2 to milestone #1", () =>
                api("POST", `/milestones/${m1.id}/gaps`, { token: leToken, body: { gapRecordId: gap2.id } }),
              );
            }
          }
          if (m2) bump("roadmap_milestones");
          if (m1 && m2) {
            await step("Case A: dependency m1 -> m2", () =>
              api("POST", `/roadmaps/${roadmapA.id}/dependencies`, {
                token: leToken,
                body: { predecessorMilestoneId: m1.id, successorMilestoneId: m2.id, dependencyType: "FINISH_TO_START" },
              }),
            );
          }
          await step("Case A: submit roadmap", () => api("POST", `/roadmaps/${roadmapA.id}/submit`, { token: leToken }));
          await step("Case A: reviewer approves roadmap", () =>
            api("POST", `/roadmaps/${roadmapA.id}/reviews`, { token: nguyenToken, body: { decision: "APPROVED", comment: "Lộ trình khả thi, đủ mốc kiểm tra trung gian." } }),
          );
          await step("Case A: transition -> ROADMAP_APPROVED", () => transitionCase(leToken, caseA!.id, "ROADMAP_APPROVED"));

          // Transfer manifest (case OWNER only)
          const manifest = await step("Case A: create transfer manifest", () =>
            api<{ id: string }>("POST", `/technology-cases/${caseA!.id}/transfer-manifests`, {
              token: leToken,
              body: { title: "Gói chuyển giao kỹ thuật cho đối tác sản xuất", note: "Bao gồm mã nguồn điều khiển robot và dữ liệu cảm biến tham chiếu." },
            }),
          );
          if (manifest) {
            bump("transfer_manifests");
            await step("Case A: add manifest item", () =>
              api("POST", `/transfer-manifests/${manifest.id}/items`, {
                token: leToken,
                body: { resourceVersionId: resources.r_robot!.versionId, permission: "DOWNLOAD" },
              }),
            );
            if (orgIds.giaiphapso) {
              await step("Case A: add manifest recipient (Giải pháp Số)", () =>
                api("POST", `/transfer-manifests/${manifest.id}/recipients`, {
                  token: leToken,
                  body: { recipientOrganizationId: orgIds.giaiphapso, permission: "DOWNLOAD" },
                }),
              );
              await step("Case A: share manifest", () =>
                api("POST", `/transfer-manifests/${manifest.id}/share`, {
                  token: leToken,
                  body: { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString() },
                }),
              );
              bump("transfer_shares");
            }
          }
        }
      }
    }
  }

  // Case B: Viện CNSH, EVIDENCE_COLLECTION only, with 1 open gap not tied to an assessment
  const CASE_B_TITLE = "Chuyển giao công nghệ chiết xuất collagen y sinh từ phụ phẩm cá tra";
  let caseB: { id: string } | undefined;
  if (orgIds.vcnsh && nguyenToken && resources.r_collagen && resources.r_vacxin && !(await caseExists(CASE_B_TITLE))) {
    caseB = await step("create Case B (evidence-collection only)", () =>
      createCase(
        nguyenToken,
        orgIds.vcnsh!,
        "Chuyển giao công nghệ chiết xuất collagen y sinh từ phụ phẩm cá tra",
        "Thương mại hóa quy trình chiết xuất collagen từ da cá tra cho ngành mỹ phẩm và thực phẩm chức năng.",
        "Collagen y sinh từ phụ phẩm thủy sản",
      ),
    );
  }
  if (caseB) {
    bump("technology_cases");
    const evB1 = await step("Case B: add evidence (patent)", () =>
      addEvidence(nguyenToken!, caseB!.id, resources.r_collagen!.versionId, "Bằng sáng chế quy trình chiết xuất", "Chứng minh quyền sở hữu trí tuệ và tính mới của quy trình.", "Là cơ sở pháp lý cho việc chuyển giao.", "Bằng sáng chế quy trình chiết xuất collagen từ da cá tra"),
    );
    const evB2 = await step("Case B: add evidence (thử nghiệm liên quan)", () =>
      addEvidence(nguyenToken!, caseB!.id, resources.r_vacxin!.versionId, "Năng lực thử nghiệm sinh học của viện", "Minh họa năng lực phòng thí nghiệm sinh học của viện có thể tái sử dụng để kiểm định chất lượng collagen.", "Tham chiếu năng lực nội bộ.", "thử nghiệm hiệu lực vắc-xin tái tổ hợp"),
    );
    bump("evidence", 2);
    const caseBEvidenceIds = [evB1?.id, evB2?.id].filter((x): x is string => Boolean(x));
    await step("Case B: transition -> EVIDENCE_COLLECTION (expected no-op, already auto-transitioned)", () =>
      transitionCase(nguyenToken!, caseB!.id, "EVIDENCE_COLLECTION"),
    );
    const gap3 = await step("Case B: create gap (evidence-based, no assessment)", () =>
      api<{ id: string }>("POST", `/technology-cases/${caseB!.id}/gaps`, {
        token: nguyenToken!,
        body: {
          title: "Chưa có đánh giá độ ổn định collagen ở quy mô công nghiệp",
          description: "Cần đánh giá độ ổn định của collagen chiết xuất khi mở rộng quy mô sản xuất từ phòng thí nghiệm lên pilot.",
          severity: "MEDIUM",
          category: "Kỹ thuật",
          evidenceIds: caseBEvidenceIds,
        },
      }),
    );
    if (gap3) bump("gaps");
  }

  // Case C: Sample RU, DRAFT with evidence attached (not transitioned) -- lifecycle variety
  const CASE_C_TITLE = "Giải pháp IoT giám sát chất lượng nước nuôi trồng thủy sản";
  let caseC: { id: string } | undefined;
  if (resources.r_iot && !(await caseExists(CASE_C_TITLE))) {
    caseC = await step("create Case C (left DRAFT with evidence)", () =>
      createCase(
        leToken,
        sampleOrg.id,
        "Giải pháp IoT giám sát chất lượng nước nuôi trồng thủy sản",
        "Đóng gói bộ dữ liệu và cảm biến IoT thành giải pháp thương mại cho các trang trại nuôi tôm quy mô vừa.",
        "IoT giám sát chất lượng nước nuôi tôm",
      ),
    );
  }
  if (caseC) {
    bump("technology_cases");
    await step("Case C: add evidence", () =>
      addEvidence(leToken, caseC!.id, resources.r_iot!.versionId, "Bộ dữ liệu cảm biến tham chiếu", "Chứng minh khả năng thu thập và phân tích dữ liệu cảm biến quy mô lớn.", "Là nền tảng dữ liệu cho giải pháp.", "cảnh báo sớm khi chất lượng nước vượt ngưỡng an toàn"),
    );
    bump("evidence");
  }

  // Case D: Viện CNSH, EVIDENCE_COLLECTION with assessment SUBMITTED (not yet decided)
  const CASE_D_TITLE = "Quy trình lên men sinh khối vi tảo Spirulina - mở rộng quy mô công nghiệp";
  let caseD: { id: string } | undefined;
  if (orgIds.vcnsh && nguyenToken && resources.r_vitao && !(await caseExists(CASE_D_TITLE))) {
    caseD = await step("create Case D (assessment SUBMITTED, pending review)", () =>
      createCase(
        nguyenToken,
        orgIds.vcnsh!,
        "Quy trình lên men sinh khối vi tảo Spirulina - mở rộng quy mô công nghiệp",
        "Đánh giá mức độ sẵn sàng để mở rộng quy trình lên men vi tảo Spirulina từ pilot 500L lên quy mô công nghiệp 10.000L.",
        "Mở rộng quy mô lên men vi tảo Spirulina",
      ),
    );
  }
  if (caseD) {
    bump("technology_cases");
    const evD1 = await step("Case D: add evidence", () =>
      addEvidence(nguyenToken!, caseD!.id, resources.r_vitao!.versionId, "Kết quả nghiên cứu quy trình pilot", "Là cơ sở khoa học cho việc đánh giá khả năng mở rộng quy mô.", "Dữ liệu gốc của case.", "đạt năng suất sinh khối cao"),
    );
    bump("evidence");
    const caseDEvidenceIds = [evD1?.id].filter((x): x is string => Boolean(x));
    await step("Case D: transition -> EVIDENCE_COLLECTION (expected no-op, already auto-transitioned)", () =>
      transitionCase(nguyenToken!, caseD!.id, "EVIDENCE_COLLECTION"),
    );
    const assessmentD = await step("Case D: create assessment", () =>
      api<{ id: string }>("POST", `/technology-cases/${caseD!.id}/assessments`, { token: nguyenToken!, body: {} }),
    );
    if (assessmentD && criteria) {
      bump("assessments");
      for (const c of criteria) {
        const mid = Math.max(c.minScore, Math.round((c.minScore + c.maxScore) / 2) - 1);
        await step(`Case D: score criterion ${c.id}`, () =>
          api("PUT", `/assessments/${assessmentD.id}/scores/${c.id}`, {
            token: nguyenToken!,
            body: {
              score: mid,
              rationale: "Đánh giá sơ bộ dựa trên kết quả pilot, còn thiếu dữ liệu vận hành liên tục dài hạn.",
              evidenceIds: caseDEvidenceIds,
            },
          }),
        );
      }
      await step("Case D: submit assessment (left pending reviewer decision)", () =>
        api("POST", `/assessments/${assessmentD.id}/submit`, { token: nguyenToken! }),
      );
    }
  }

  console.log("=== Phase E done. Counts so far:", JSON.stringify(counts));

  // ---------------- PHASE F: Company & Discovery ----------------
  let companyProfile: { organizationId: string; publicSlug: string } | undefined;
  const giaiphapsoOwnerToken = orgIds.giaiphapso ? await login("giamdoc@giaiphapso-demo.vn") : undefined;
  // Idempotency guard: if this org's company profile already exists (prior run), Phase F's
  // needs/proposals/recommendation-runs were almost certainly already created too — skip
  // re-running the rest of Phase F entirely rather than creating duplicate research needs.
  let phaseFAlreadyDone = false;
  const N1_TITLE = "Tìm giải pháp thị giác máy tính kiểm tra khuyết tật mối hàn tự động";
  const N2_TITLE = "Nhu cầu giải pháp IoT giám sát chất lượng nước nuôi trồng thủy sản";
  const N3_TITLE = "Tìm kiếm công nghệ vi tảo sinh khối cho thực phẩm chức năng";
  if (orgIds.giaiphapso) {
    const existingProfile = await findCompanyProfileOrgId(orgIds.giaiphapso);
    if (existingProfile) {
      companyProfile = existingProfile;
      phaseFAlreadyDone = true;
      console.log("[skip] company profile / research-need creation — already exist from a prior run (re-populating ids from DB, recommendation runs still re-triggered below since resource_chunk data may be newly available this run)");
    }
  }
  if (orgIds.giaiphapso && giaiphapsoOwnerToken && !phaseFAlreadyDone) {
    companyProfile = await step("create company profile: Giải pháp Số", () =>
      api<{ organizationId: string; publicSlug: string }>("POST", `/organizations/${orgIds.giaiphapso}/company-profile`, {
        token: giaiphapsoOwnerToken,
        body: {
          industryCode: "Công nghệ thông tin - Tự động hóa công nghiệp",
          companySize: "51-200",
          description: "Chuyên cung cấp giải pháp thị giác máy tính, robot công nghiệp và IoT cho nhà máy sản xuất tại Việt Nam.",
        },
      }),
    );
    if (companyProfile) bump("company_profiles");
  }

  interface NeedResult {
    id: string;
    versionId?: string;
  }
  const needs: Record<string, NeedResult> = {};
  if (orgIds.giaiphapso && giaiphapsoOwnerToken && !phaseFAlreadyDone) {
    const n1 = await step("create research need N1 (robot hàn / thị giác máy tính)", () =>
      api<{ id: string }>("POST", "/research-needs", {
        token: giaiphapsoOwnerToken,
        body: {
          companyOrganizationId: orgIds.giaiphapso,
          title: "Tìm giải pháp thị giác máy tính kiểm tra khuyết tật mối hàn tự động",
          problemStatement: "Nhà máy cần một hệ thống thị giác máy tính tích hợp robot hàn để phát hiện khuyết tật mối hàn theo thời gian thực, giảm tỷ lệ lỗi và chi phí kiểm tra thủ công trên dây chuyền sản xuất ô tô.",
          technicalField: "Thị giác máy tính công nghiệp",
          desiredOutputType: "Giải pháp phần mềm + phần cứng thử nghiệm pilot",
          timeframeMonths: 12,
          visibility: "PUBLIC",
        },
      }),
    );
    if (n1) {
      needs.n1 = { id: n1.id };
      bump("research_needs");
      await step("publish N1", () => api("POST", `/research-needs/${n1.id}/publish`, { token: giaiphapsoOwnerToken }));
    }

    const n2 = await step("create research need N2 (IoT nước nuôi trồng thủy sản)", () =>
      api<{ id: string }>("POST", "/research-needs", {
        token: giaiphapsoOwnerToken,
        body: {
          companyOrganizationId: orgIds.giaiphapso,
          title: "Nhu cầu giải pháp IoT giám sát chất lượng nước nuôi trồng thủy sản",
          problemStatement: "Doanh nghiệp cần hệ thống cảm biến IoT giám sát chất lượng nước và cảnh báo sớm cho các trang trại nuôi tôm đối tác, tích hợp được với ao nuôi hiện có.",
          technicalField: "IoT nông nghiệp - thủy sản",
          desiredOutputType: "Giải pháp trọn gói phần cứng + phần mềm",
          timeframeMonths: 9,
          visibility: "PUBLIC",
        },
      }),
    );
    if (n2) {
      needs.n2 = { id: n2.id };
      bump("research_needs");
      await step("publish N2", () => api("POST", `/research-needs/${n2.id}/publish`, { token: giaiphapsoOwnerToken }));
    }

    const n3 = await step("create research need N3 (vi tảo, left DRAFT)", () =>
      api<{ id: string }>("POST", "/research-needs", {
        token: giaiphapsoOwnerToken,
        body: {
          companyOrganizationId: orgIds.giaiphapso,
          title: "Tìm kiếm công nghệ vi tảo sinh khối cho thực phẩm chức năng",
          problemStatement: "Doanh nghiệp đang khảo sát các công nghệ lên men vi tảo sinh khối để phát triển dòng sản phẩm thực phẩm chức năng mới, ưu tiên công nghệ đã có kết quả pilot.",
          technicalField: "Công nghệ sinh học thực phẩm",
          desiredOutputType: "Báo cáo khảo sát công nghệ + đề xuất hợp tác",
          timeframeMonths: 6,
          visibility: "PUBLIC",
        },
      }),
    );
    if (n3) {
      needs.n3 = { id: n3.id };
      bump("research_needs");
      // left DRAFT deliberately for status variety.
    }

    // votes/saves on research needs
    for (const [key, token] of [["n1", adminToken], ["n2", reviewerToken]] as const) {
      if (needs[key]) {
        const ok = await step(`vote research need ${key}`, () => api("POST", `/research-needs/${needs[key]!.id}/votes`, { token }));
        if (ok !== undefined) bump("content_votes");
      }
    }
    if (needs.n1 && leToken) {
      const ok = await step("save research need n1", () => api("POST", `/research-needs/${needs.n1!.id}/saves`, { token: leToken }));
      if (ok !== undefined) bump("content_saves");
    }
  } else if (phaseFAlreadyDone) {
    // Re-populate need ids from a prior run so recommendation-run re-triggering below still
    // has something to point at (resource_chunk data may not have existed on the prior run).
    const [existingN1, existingN2, existingN3] = await Promise.all([
      findResearchNeedByTitle(N1_TITLE),
      findResearchNeedByTitle(N2_TITLE),
      findResearchNeedByTitle(N3_TITLE),
    ]);
    if (existingN1) needs.n1 = { id: existingN1.id };
    if (existingN2) needs.n2 = { id: existingN2.id };
    if (existingN3) needs.n3 = { id: existingN3.id };
  }

  // Recommendation runs (FOCUSED)
  interface RunResult {
    id: string;
  }
  let n1Run: RunResult | undefined;
  if (needs.n1 && giaiphapsoOwnerToken) {
    n1Run = await step("trigger FOCUSED recommendation run for N1", () =>
      api<{ id: string }>("POST", `/research-needs/${needs.n1!.id}/recommendation-runs`, { token: giaiphapsoOwnerToken }),
    );
    if (n1Run) bump("recommendation_runs");
  }
  if (needs.n2 && giaiphapsoOwnerToken) {
    const r = await step("trigger FOCUSED recommendation run for N2", () =>
      api<{ id: string }>("POST", `/research-needs/${needs.n2!.id}/recommendation-runs`, { token: giaiphapsoOwnerToken }),
    );
    if (r) bump("recommendation_runs");
  }
  // The worker's outbox-dispatcher poll loop processes the run asynchronously — poll its
  // status instead of a fixed sleep.
  async function waitForRunCompletion(runId: string, token: string): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const run = await api<{ status: string }>("GET", `/recommendation-runs/${runId}`, { token });
      if (run.status === "COMPLETED" || run.status === "FAILED") return;
      await sleep(1500);
    }
  }
  if (n1Run && giaiphapsoOwnerToken) await step("wait for N1 run completion", () => waitForRunCompletion(n1Run!.id, giaiphapsoOwnerToken));

  let n1RecommendationItems: { id: string; resourceVersionId: string }[] = [];
  if (n1Run && giaiphapsoOwnerToken) {
    n1RecommendationItems =
      (await step("fetch N1 recommendation items", () =>
        api<{ id: string; resourceVersionId: string }[]>("GET", `/recommendation-runs/${n1Run!.id}/items`, { token: giaiphapsoOwnerToken }),
      )) ?? [];
    console.log(`  N1 recommendation items: ${n1RecommendationItems.length}`);
  }

  // Feed
  if (orgIds.giaiphapso && giaiphapsoOwnerToken && companyProfile) {
    await step("refresh company feed", () =>
      api("POST", `/organizations/${orgIds.giaiphapso}/company-profile/feed/refresh`, { token: giaiphapsoOwnerToken }),
    );
    bump("feed_runs");
    await sleep(2000);
    const feed = await step("fetch company feed", () =>
      api<unknown[]>("GET", `/organizations/${orgIds.giaiphapso}/company-profile/feed`, { token: giaiphapsoOwnerToken }),
    );
    console.log(`  feed items: ${(feed ?? []).length}`);
  }

  // Research proposals
  async function proposalExists(title: string): Promise<boolean> {
    const db = getDb();
    const result = (await db.execute(sql`select id from research_proposal where title = ${title} limit 1`)) as unknown as {
      rows: { id: string }[];
    };
    return result.rows.length > 0;
  }
  const P1_TITLE = "Đề xuất ứng dụng mô hình học sâu phát hiện khuyết tật mối hàn thời gian thực";
  const P2_TITLE = "Đề xuất bộ giải pháp IoT giám sát nước ao nuôi trọn gói";
  if (needs.n1 && nguyenToken && orgIds.vcnsh && !(await proposalExists(P1_TITLE))) {
    const p1 = await step("submit research proposal (TS. Nguyễn Thị Lan -> N1)", () =>
      api<{ id: string }>("POST", `/research-needs/${needs.n1!.id}/proposals`, {
        token: nguyenToken,
        body: {
          proposerOrganizationId: orgIds.vcnsh,
          title: "Đề xuất ứng dụng mô hình học sâu phát hiện khuyết tật mối hàn thời gian thực",
          abstract: "Đề xuất triển khai mô hình CNN nhẹ chạy trên biên (edge) tích hợp với robot hàn hiện có, đã được kiểm chứng qua case nội bộ tại đơn vị.",
          methodology: "Sử dụng kiến trúc CNN tối ưu cho triển khai edge, huấn luyện trên tập dữ liệu ảnh khuyết tật mối hàn thu thập thực địa, đánh giá qua thử nghiệm A/B trên dây chuyền thật.",
          expectedOutcome: "Giảm tỷ lệ lỗi mối hàn không phát hiện được xuống dưới 2%, giảm 40% thời gian kiểm tra thủ công.",
          timelineMonths: 8,
        },
      }),
    );
    if (p1) {
      bump("research_proposals");
      await step("submit(1)->UNDER_REVIEW proposal p1", () => api("POST", `/proposals/${p1.id}/review`, { token: giaiphapsoOwnerToken! }));
      await step("accept proposal p1 (creates technology case)", () => api("POST", `/proposals/${p1.id}/accept`, { token: giaiphapsoOwnerToken! }));
      bump("technology_cases"); // accept() creates a case via createCaseCore
    }
  }
  if (needs.n2 && leToken && !(await proposalExists(P2_TITLE))) {
    const p2 = await step("submit research proposal (Lê Thị Hương -> N2)", () =>
      api<{ id: string }>("POST", `/research-needs/${needs.n2!.id}/proposals`, {
        token: leToken,
        body: {
          proposerOrganizationId: sampleOrg.id,
          title: "Đề xuất bộ giải pháp IoT giám sát nước ao nuôi trọn gói",
          abstract: "Đề xuất đóng gói bộ cảm biến IoT và nền tảng phân tích đã vận hành thử nghiệm thành sản phẩm thương mại cho trang trại đối tác.",
          methodology: "Triển khai thí điểm tại 3 ao nuôi đối tác, thu thập phản hồi và tinh chỉnh ngưỡng cảnh báo trong 3 tháng đầu.",
          expectedOutcome: "Giảm 30% tỷ lệ tôm chết do chất lượng nước không kiểm soát kịp thời.",
          timelineMonths: 6,
        },
      }),
    );
    if (p2) {
      bump("research_proposals");
      await step("submit(2)->UNDER_REVIEW proposal p2", () => api("POST", `/proposals/${p2.id}/review`, { token: giaiphapsoOwnerToken! }));
      await step("reject proposal p2 (with reason, left REJECTED)", () =>
        api("POST", `/proposals/${p2.id}/reject`, {
          token: giaiphapsoOwnerToken!,
          body: { decisionReason: "Doanh nghiệp đã có đối tác triển khai giải pháp tương tự trong giai đoạn hiện tại, sẽ cân nhắc lại ở đợt sau." },
        }),
      );
    }
  }

  // Case initiation (from a recommendation item, if any were found). The recommendation
  // engine may rank a pre-existing (non-demo) resource above ours depending on FTS score,
  // so resolve the item's actual resourceVersionId -> resource.createdByUserId via a
  // read-only lookup rather than assuming it's r_robot/Lê Thị Hương — only proceed with
  // accept() if it happens to be one of our own known demo authors (otherwise we don't
  // hold a valid token to respond as that author, so skip gracefully).
  const authorTokenByUserId: Record<string, string> = {};
  if (memberUserIds[authorLeEmail]) authorTokenByUserId[memberUserIds[authorLeEmail]] = leToken;
  if (memberUserIds[tsNguyenEmail] && nguyenToken) authorTokenByUserId[memberUserIds[tsNguyenEmail]] = nguyenToken;
  if (n1RecommendationItems.length > 0 && giaiphapsoOwnerToken) {
    const item = n1RecommendationItems[0]!;
    const ci = await step("create case-initiation-request from recommendation item", () =>
      api<{ id: string }>("POST", `/recommendation-items/${item.id}/case-initiation-requests`, {
        token: giaiphapsoOwnerToken,
        body: { message: "Chúng tôi rất quan tâm hợp tác thương mại hóa công nghệ này, mong được trao đổi thêm." },
      }),
    );
    if (ci) {
      bump("case_initiation_requests");
      const db = getDb();
      const ownerRow = (await db.execute(
        sql`select r.created_by_user_id as "createdByUserId" from resource_version rv join resource r on r.id = rv.resource_id where rv.id = ${item.resourceVersionId} limit 1`,
      )) as unknown as { rows: { createdByUserId: string }[] };
      const targetToken = ownerRow.rows[0] ? authorTokenByUserId[ownerRow.rows[0].createdByUserId] : undefined;
      if (targetToken) {
        await step("accept case-initiation-request", () => api("POST", `/case-initiation-requests/${ci.id}/accept`, { token: targetToken }));
        bump("technology_cases"); // accept creates a case too
      } else {
        console.log("  [skip] case-initiation accept — top-ranked recommendation item belongs to a non-demo resource, left PENDING for state variety");
      }
    }
  }

  console.log("=== Phase F done. Counts so far:", JSON.stringify(counts));

  // ---------------- PHASE G: Community (follows, endorsements, activity feed) ----------------
  // fetch public slugs
  const vcnshOrgSlug = orgIds.vcnsh ? await step("get Viện CNSH org detail (for slug)", () => api<{ slug: string }>("GET", `/organizations/${orgIds.vcnsh}`, { token: adminToken })) : undefined;

  if (memberUserIds[tsNguyenEmail]) {
    const nguyenProfile = await step("fetch TS. Nguyễn Thị Lan public profile (get slug)", async () => {
      const db = getDb();
      const row = await db.query.authorProfile.findFirst({ where: eq(authorProfile.userId, memberUserIds[tsNguyenEmail]!) });
      return row;
    });
    if (nguyenProfile?.publicSlug) {
      const ok = await step("Lê Thị Hương follows TS. Nguyễn Thị Lan", () =>
        api("POST", `/authors/${nguyenProfile.publicSlug}/follow`, { token: leToken }),
      );
      if (ok !== undefined) bump("author_follows");
      if (nguyenProfile.expertiseTags?.length) {
        const ok2 = await step("Lê Thị Hương endorses TS. Nguyễn Thị Lan's expertise tag", () =>
          api("POST", `/authors/${nguyenProfile.publicSlug}/expertise/${encodeURIComponent(nguyenProfile.expertiseTags![0]!)}/endorsements`, {
            token: leToken,
          }),
        );
        if (ok2 !== undefined) bump("expertise_endorsements");
      }
    }
  }
  if (vcnshOrgSlug?.slug && giaiphapsoOwnerToken) {
    const ok = await step("Giải pháp Số follows Viện CNSH (org follow)", () =>
      api("POST", `/organizations/${vcnshOrgSlug.slug}/follow`, { token: giaiphapsoOwnerToken }),
    );
    if (ok !== undefined) bump("organization_follows");
  }

  if (nguyenToken) {
    const feed = await step("fetch activity feed (Lê Thị Hương -> follows Nguyễn Thị Lan)", () =>
      api<unknown[]>("GET", "/activity-feed", { token: leToken }),
    );
    console.log(`  activity feed items for Lê Thị Hương: ${(feed ?? []).length}`);
  }

  // ---------------- PHASE H: Moderation ----------------
  async function alreadyFlagged(resourceId: string): Promise<boolean> {
    const db = getDb();
    const result = (await db.execute(
      sql`select id from content_flag where target_resource_id = ${resourceId} limit 1`,
    )) as unknown as { rows: { id: string }[] };
    return result.rows.length > 0;
  }
  if (resources.r_pin && !(await alreadyFlagged(resources.r_pin.id))) {
    const f1 = await step("flag resource r_pin (MISLEADING_CLAIM)", () =>
      api<{ id: string }>("POST", "/content-flags", {
        token: reviewerToken,
        body: { targetType: "RESOURCE", targetId: resources.r_pin!.id, reasonCode: "MISLEADING_CLAIM", details: "Số liệu mật độ năng lượng công bố cao bất thường so với các nghiên cứu cùng lĩnh vực, cần rà soát lại." },
      }),
    );
    if (f1) {
      bump("content_flags");
      await step("claim flag f1", () => api("POST", `/platform/content-flags/${f1.id}/claim`, { token: adminToken }));
      await step("decide flag f1 -> KEEP (dismissed)", () =>
        api("POST", `/platform/content-flags/${f1.id}/decision`, {
          token: adminToken,
          body: { action: "KEEP", rationale: "Đã đối chiếu với báo cáo gốc, số liệu hợp lệ trong điều kiện thử nghiệm đã công bố." },
        }),
      );
    }
  }
  if (resources.r_vacxin && !(await alreadyFlagged(resources.r_vacxin.id))) {
    const f2 = await step("flag resource r_vacxin (left IN_REVIEW)", () =>
      api<{ id: string }>("POST", "/content-flags", {
        token: giaiphapsoOwnerToken ?? adminToken,
        body: { targetType: "RESOURCE", targetId: resources.r_vacxin!.id, reasonCode: "DATA_QUALITY", details: "Cỡ mẫu thử nghiệm (12 bể) có vẻ nhỏ để kết luận hiệu lực vắc-xin, đề nghị rà soát phương pháp thống kê." },
      }),
    );
    if (f2) {
      bump("content_flags");
      await step("claim flag f2 (left undecided -> IN_REVIEW)", () => api("POST", `/platform/content-flags/${f2.id}/claim`, { token: reviewerToken }));
    }
  }
  if (resources.r_iot && !(await alreadyFlagged(resources.r_iot.id))) {
    const f3 = await step("flag resource r_iot (left PENDING, unclaimed)", () =>
      api<{ id: string }>("POST", "/content-flags", {
        token: phamToken,
        body: { targetType: "RESOURCE", targetId: resources.r_iot!.id, reasonCode: "OTHER", details: "Thiếu thông tin về vị trí địa lý cụ thể thu thập dữ liệu, khó đánh giá khả năng áp dụng cho vùng khác." },
      }),
    );
    if (f3) bump("content_flags");
  }

  // ---------------- Report ----------------
  console.log("\n=== DONE ===");
  console.log("Counts:", JSON.stringify(counts, null, 2));
  console.log(`Failures (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);

  await closeDb();
}

main().catch(async (error) => {
  console.error("[demo-seed] fatal error", error);
  await closeDb().catch(() => {});
  process.exitCode = 1;
});
