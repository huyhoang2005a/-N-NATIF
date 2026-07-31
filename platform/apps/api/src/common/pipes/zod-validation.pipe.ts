import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Validates the request body against a zod schema shared with the frontend via
 * @r2m/contracts, so the API and the DTO the client builds never drift apart.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
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
