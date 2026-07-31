import { describe, expect, it } from "vitest";
import { loadEnv, resetEnvCacheForTests } from "./env";

const validEnv = {
  DATABASE_URL: "postgres://r2m:r2m@localhost:5432/r2m_dev",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_VERIFICATION_BUCKET: "verification",
  S3_RESOURCE_BUCKET: "resource",
  JWT_ACCESS_SECRET: "0123456789abcdef",
  JWT_REFRESH_SECRET: "fedcba9876543210",
};

describe("loadEnv", () => {
  it("parses a valid environment and applies defaults", () => {
    resetEnvCacheForTests();
    const env = loadEnv(validEnv as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.API_PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
  });

  it("throws with an actionable message when required vars are missing", () => {
    resetEnvCacheForTests();
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });
});
