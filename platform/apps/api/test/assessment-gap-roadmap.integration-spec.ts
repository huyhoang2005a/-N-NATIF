import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { closeDb, getDb, schema } from "@r2m/database";
import { createTestOrganization, createTestUser, resetDatabase } from "@r2m/testkit";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { TokenService } from "../src/modules/identity-organization/auth/token.service";

/**
 * Bắt buộc theo ghi chú Phase 4 mới trong CLAUDE.md: ít nhất 1 integration test qua
 * NestJS DI container thật cho aggregator module mới thêm (`AssessmentGapModule`/
 * `RoadmapTransferModule`). Dựng org/case/framework trực tiếp qua db insert (không đi
 * qua Phase 1-3 HTTP flow đầy đủ — không cần thiết cho mục tiêu của file này), rồi lái
 * toàn bộ nghiệp vụ Phase 4 qua HTTP thật: assessment -> submit (composite score qua HTTP
 * thật) -> decision (rule 12 — CASE_REVIEWER-only) -> gap CRITICAL -> roadmap ->
 * dependency cycle -> review (critical-gap gate) -> case cascade tới ROADMAP_APPROVED.
 */
describe("AssessmentGapModule + RoadmapTransferModule (integration)", () => {
  let app: INestApplication;
  const db = getDb();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("v1");
    await app.init();
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await app.close();
    await closeDb();
  });

  async function setupCaseWithFramework() {
    const ownerUser = await createTestUser(db);
    const reviewerUser = await createTestUser(db);
    const org = await createTestOrganization(db, ownerUser.id, { status: "ACTIVE" });

    const [technologyCase] = await db
      .insert(schema.technologyCase)
      .values({
        owningOrganizationId: org.id,
        title: "Integration Test Case",
        slug: `integration-test-case-${Date.now()}`,
        lifecycleStatus: "EVIDENCE_COLLECTION",
        createdByUserId: ownerUser.id,
      })
      .returning();
    if (!technologyCase) throw new Error("failed to create technology case");

    await db.insert(schema.caseMember).values([
      {
        technologyCaseId: technologyCase.id,
        userId: ownerUser.id,
        organizationId: org.id,
        role: "OWNER",
        status: "ACTIVE",
      },
      {
        technologyCaseId: technologyCase.id,
        userId: reviewerUser.id,
        organizationId: org.id,
        role: "CASE_REVIEWER",
        status: "ACTIVE",
      },
    ]);

    const [systemUser] = await db
      .insert(schema.userAccount)
      .values({ primaryEmail: `framework-owner-${Date.now()}@example.test`, status: "ACTIVE" })
      .returning();
    if (!systemUser) throw new Error("failed to create framework-owning user");

    const [framework] = await db
      .insert(schema.assessmentFramework)
      .values({
        code: `INTEGRATION_TEST_${Date.now()}`,
        name: "Integration Test Framework",
        versionNo: 1,
        status: "ACTIVE",
        createdByUserId: systemUser.id,
      })
      .returning();
    if (!framework) throw new Error("failed to create framework");

    // requiresEvidence/requiresCitation=false — không cần dựng evidence/citation thật ở
    // file test này, mục tiêu là xác nhận DI/HTTP/composite score, không phải Phase 3.
    const [criterionA, criterionB] = await db
      .insert(schema.assessmentCriterion)
      .values([
        {
          frameworkId: framework.id,
          categoryCode: "CATEGORY_A",
          criterionCode: "CRITERION_A",
          title: "Criterion A",
          description: "Criterion A description",
          minScore: "0",
          maxScore: "10",
          weight: "2",
          requiresEvidence: false,
          requiresCitation: false,
          sortOrder: 0,
        },
        {
          frameworkId: framework.id,
          categoryCode: "CATEGORY_B",
          criterionCode: "CRITERION_B",
          title: "Criterion B",
          description: "Criterion B description",
          minScore: "0",
          maxScore: "10",
          weight: "1",
          requiresEvidence: false,
          requiresCitation: false,
          sortOrder: 1,
        },
      ])
      .returning();
    if (!criterionA || !criterionB) throw new Error("failed to create criteria");

    const tokenService = app.get(TokenService);
    const ownerToken = tokenService.signAccessToken(ownerUser.id).token;
    const reviewerToken = tokenService.signAccessToken(reviewerUser.id).token;

    return { technologyCase, org, ownerUser, reviewerUser, ownerToken, reviewerToken, criterionA, criterionB };
  }

  it("submits an assessment over real HTTP and returns the server-computed composite score", async () => {
    const { technologyCase, ownerToken, criterionA, criterionB } = await setupCaseWithFramework();
    const server = app.getHttpServer();

    const createRes = await request(server)
      .post(`/v1/technology-cases/${technologyCase.id}/assessments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(createRes.status).toBe(201);
    const assessmentId = createRes.body.id as string;

    // score A=8 (weight 2), score B=5 (weight 1) -> 100 * (0.8*2 + 0.5*1) / 3 = 70.0000
    const scoreARes = await request(server)
      .put(`/v1/assessments/${assessmentId}/scores/${criterionA.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ score: 8, rationale: "Strong prototype", evidenceIds: [], citationIds: [] });
    expect(scoreARes.status).toBe(200);

    const scoreBRes = await request(server)
      .put(`/v1/assessments/${assessmentId}/scores/${criterionB.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ score: 5, rationale: "Moderate market fit", evidenceIds: [], citationIds: [] });
    expect(scoreBRes.status).toBe(200);

    const submitRes = await request(server)
      .post(`/v1/assessments/${assessmentId}/submit`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.status).toBe("SUBMITTED");
    expect(submitRes.body.compositeScore).toBeCloseTo(70, 4);

    const updatedCase = await db.query.technologyCase.findFirst({ where: (t, { eq }) => eq(t.id, technologyCase.id) });
    expect(updatedCase?.lifecycleStatus).toBe("UNDER_ASSESSMENT");
  });

  it("rejects an OWNER trying to decide their own submitted assessment (rule 12) but accepts CASE_REVIEWER", async () => {
    const { technologyCase, ownerToken, reviewerToken, criterionA, criterionB } = await setupCaseWithFramework();
    const server = app.getHttpServer();

    const createRes = await request(server)
      .post(`/v1/technology-cases/${technologyCase.id}/assessments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    const assessmentId = createRes.body.id as string;

    await request(server)
      .put(`/v1/assessments/${assessmentId}/scores/${criterionA.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ score: 8, rationale: "Strong prototype", evidenceIds: [], citationIds: [] });
    await request(server)
      .put(`/v1/assessments/${assessmentId}/scores/${criterionB.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ score: 5, rationale: "Moderate market fit", evidenceIds: [], citationIds: [] });
    await request(server).post(`/v1/assessments/${assessmentId}/submit`).set("Authorization", `Bearer ${ownerToken}`);

    const ownerDecisionRes = await request(server)
      .post(`/v1/assessments/${assessmentId}/decision`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ decision: "APPROVE" });
    expect(ownerDecisionRes.status).toBe(403);
    expect(ownerDecisionRes.body.error.code).toBe("AUTH_FORBIDDEN");

    const reviewerDecisionRes = await request(server)
      .post(`/v1/assessments/${assessmentId}/decision`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ decision: "APPROVE" });
    expect(reviewerDecisionRes.status).toBe(201);
    expect(reviewerDecisionRes.body.status).toBe("APPROVED");
  });

  it("blocks roadmap approval while a CRITICAL gap is open, then allows it once resolved (case reaches ROADMAP_APPROVED)", async () => {
    const { technologyCase, ownerToken, reviewerToken, criterionA } = await setupCaseWithFramework();
    const server = app.getHttpServer();

    // Gap cần ≥1 nguồn support (quyết định 11): dùng `sourceAssessmentId` — không dựng
    // evidence/citation thật ở đây (đòi hỏi cả resource/resource_version, ngoài phạm vi
    // file test này, xem `setupCaseWithFramework`). Submit assessment trước để case đi
    // qua đúng cascade EVIDENCE_COLLECTION -> UNDER_ASSESSMENT -> GAP_IDENTIFIED (không
    // nhảy state — đúng §8).
    const sourceAssessmentRes = await request(server)
      .post(`/v1/technology-cases/${technologyCase.id}/assessments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    const sourceAssessmentId = sourceAssessmentRes.body.id as string;
    await request(server)
      .put(`/v1/assessments/${sourceAssessmentId}/scores/${criterionA.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ score: 6, rationale: "Baseline", evidenceIds: [], citationIds: [] });
    const submitSourceRes = await request(server)
      .post(`/v1/assessments/${sourceAssessmentId}/submit`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(submitSourceRes.status).toBe(201);

    const caseAfterSubmit = await db.query.technologyCase.findFirst({ where: (t, { eq }) => eq(t.id, technologyCase.id) });
    expect(caseAfterSubmit?.lifecycleStatus).toBe("UNDER_ASSESSMENT");

    const gapRes = await request(server)
      .post(`/v1/technology-cases/${technologyCase.id}/gaps`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "No IP filing",
        description: "Patent not filed",
        severity: "CRITICAL",
        sourceAssessmentId,
        evidenceIds: [],
      });
    expect(gapRes.status).toBe(201);
    const gapId = gapRes.body.id as string;

    const caseAfterGap = await db.query.technologyCase.findFirst({ where: (t, { eq }) => eq(t.id, technologyCase.id) });
    expect(caseAfterGap?.lifecycleStatus).toBe("GAP_IDENTIFIED");

    const roadmapRes = await request(server)
      .post(`/v1/technology-cases/${technologyCase.id}/roadmaps`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Q1 roadmap" });
    expect(roadmapRes.status).toBe(201);
    const roadmapId = roadmapRes.body.id as string;

    const milestoneRes = await request(server)
      .post(`/v1/roadmaps/${roadmapId}/milestones`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "File patent", priority: "HIGH" });
    expect(milestoneRes.status).toBe(201);

    await request(server).post(`/v1/roadmaps/${roadmapId}/submit`).set("Authorization", `Bearer ${ownerToken}`);

    const blockedReview = await request(server)
      .post(`/v1/roadmaps/${roadmapId}/reviews`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ decision: "APPROVED" });
    expect(blockedReview.status).toBe(409);
    expect(blockedReview.body.error.code).toBe("ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS");

    // OPEN -> RESOLVED không phải cạnh hợp lệ trong state machine (đúng §8: không nhảy
    // state) — phải qua IN_PROGRESS trước.
    const inProgressRes = await request(server)
      .post(`/v1/gaps/${gapId}/transition`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ toStatus: "IN_PROGRESS" });
    expect(inProgressRes.status).toBe(201);

    const resolveRes = await request(server)
      .post(`/v1/gaps/${gapId}/transition`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ toStatus: "RESOLVED", resolutionNote: "Provisional patent filed" });
    expect(resolveRes.status).toBe(201);

    const approvedReview = await request(server)
      .post(`/v1/roadmaps/${roadmapId}/reviews`)
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({ decision: "APPROVED", comment: "Looks good" });
    expect(approvedReview.status).toBe(201);
    expect(approvedReview.body.status).toBe("APPROVED");

    const finalCase = await db.query.technologyCase.findFirst({ where: (t, { eq }) => eq(t.id, technologyCase.id) });
    expect(finalCase?.lifecycleStatus).toBe("ROADMAP_APPROVED");
  });
});
