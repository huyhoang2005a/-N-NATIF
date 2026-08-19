import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { closeDb, getDb } from "@r2m/database";
import { createTestUser, resetDatabase } from "@r2m/testkit";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { TokenService } from "../src/modules/identity-organization/auth/token.service";

/**
 * `IdentityOrganizationModule` is the module bug #5 broke (aggregator `imports` without
 * `exports`, so the globally-registered `JwtAuthGuard` couldn't resolve `TokenService` —
 * every request 500'd despite a clean build/typecheck/lint/test). Real HTTP calls through
 * the fully-booted app are the only way that class of bug shows up — this file proves
 * the guard doesn't just exist, it actually rejects/accepts requests correctly.
 */
describe("IdentityOrganizationModule (integration)", () => {
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

  describe("GET /v1/me/profile (protected by the global JwtAuthGuard)", () => {
    it("rejects a request with no bearer token", async () => {
      const response = await request(app.getHttpServer()).get("/v1/me/profile");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });

    it("accepts a request with a valid access token for an ACTIVE user", async () => {
      const user = await createTestUser(db);
      const tokenService = app.get(TokenService);
      const { token } = tokenService.signAccessToken(user.id);

      const response = await request(app.getHttpServer())
        .get("/v1/me/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(user.id);
    });
  });

  describe("POST /v1/organizations/register (UC-ORG-01, @Public)", () => {
    // Multipart, not JSON — registration carries the mandatory minimum verification
    // document (organization.dto.ts `RegisterOrganizationWithDocumentSchema`) in the same
    // call since the "vá lỗ hổng xác minh" fix; a plain `.send({...})` JSON body 400s here
    // with no `file`/`documentType`.
    it("registers a new organization end-to-end", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/organizations/register")
        .field("organizationName", "Integration Test Org")
        .field("organizationType", "RESEARCH_UNIT")
        .field("ownerEmail", "integration-owner@example.test")
        .field("ownerPassword", "password123")
        .field("ownerDisplayName", "Integration Owner")
        .field("documentType", "TAX_DOCUMENT")
        .attach("file", Buffer.from("%PDF-1.4\n%%EOF"), { filename: "tax-document.pdf", contentType: "application/pdf" });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Integration Test Org");
      expect(response.body.status).toBe("PENDING_VERIFICATION");
    });
  });
});
