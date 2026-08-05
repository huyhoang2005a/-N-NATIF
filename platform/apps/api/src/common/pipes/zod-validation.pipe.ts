import { BadRequestException, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Validates the request body against a zod schema shared with the frontend via
 * @r2m/contracts, so the API and the DTO the client builds never drift apart.
 *
 * `@UsePipes()` at the method level runs this pipe for EVERY handler argument, not just
 * `@Body()` — so on any route that also has `@Param()` (e.g. `POST :id/decision`), the
 * route id string would otherwise be run through this same object schema and fail with
 * "Expected object, received string" before the real body is ever checked. Only validate
 * the `body` argument; let every other argument type pass through untouched.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    if (metadata.type !== "body") {
      return value as T;
    }
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request payload failed validation.",
          details: { issues: result.error.issues },
        },
      });
    }
    return result.data;
  }
}
