import type { ArgumentMetadata } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

const schema = z.object({ decision: z.enum(["APPROVE", "REJECT"]) });

describe("ZodValidationPipe", () => {
  it("validates a body argument against the schema", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ decision: "APPROVE" }, { type: "body" } as ArgumentMetadata)).toEqual({
      decision: "APPROVE",
    });
  });

  it("rejects an invalid body argument", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ decision: "MAYBE" }, { type: "body" } as ArgumentMetadata)).toThrow();
  });

  /**
   * Regression test: method-scoped `@UsePipes()` runs this pipe for every handler
   * argument. A route like `POST :id/decision` combines `@Param("id")` with the same
   * pipe used for `@Body()` — without this guard, the id string was parsed against the
   * body schema and always failed with "Expected object, received string" in production,
   * even though every unit test (which calls services directly, bypassing pipes) passed.
   */
  it("passes non-body arguments through untouched", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform("some-uuid", { type: "param", data: "id" } as ArgumentMetadata)).toBe("some-uuid");
    expect(pipe.transform(undefined, { type: "custom" } as ArgumentMetadata)).toBeUndefined();
  });
});
