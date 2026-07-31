import type { ErrorCode } from "./error-codes";

/**
 * Base type for every business-rule violation. Carries a stable `code` (never a free-form
 * message) plus an HTTP status hint so the API layer's exception filter can translate it
 * into the unified error envelope without inspecting the message text.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { httpStatus?: number; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = options?.httpStatus ?? 422;
    this.details = options?.details;
  }
}

export class ConflictError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, { httpStatus: 409, details });
    this.name = "ConflictError";
  }
}

export class NotFoundError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, { httpStatus: 404, details });
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, { httpStatus: 403, details });
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, { httpStatus: 401, details });
    this.name = "UnauthenticatedError";
  }
}
