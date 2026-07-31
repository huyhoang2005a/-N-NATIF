import { DomainError } from "@r2m/domain";
import { type ArgumentsHost, Catch, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Translates a DomainError into the unified error envelope from architecture plan §10/§13.1.
 * The HTTP status and error `code` come from the exception itself — controllers never choose
 * a status code for a business-rule violation.
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    response.status(exception.httpStatus).json({
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details ?? {},
        traceId: request.headers["x-request-id"] ?? null,
      },
    });
  }
}
