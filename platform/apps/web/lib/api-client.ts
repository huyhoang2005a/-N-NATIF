import type { TokenResponse } from "@r2m/contracts";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./session";

export interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown>; traceId?: string };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown by `authFetch` when the caller has no usable session left (no/expired refresh
 * token) — pages catching this should clear local UI state and redirect to `/login`. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired.");
    this.name = "SessionExpiredError";
  }
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/v1";
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { accessToken?: string },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (init?.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }

  const response = await fetch(`${baseUrl()}${path}`, { ...init, headers });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
    if (body?.error) {
      throw new ApiError(body.error.code, body.error.message, body.error.details);
    }
    throw new ApiError("UNKNOWN_ERROR", `Request failed with status ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * `apiFetch` for authenticated pages: attaches the stored access token and, on
 * AUTH_UNAUTHENTICATED (JwtAuthGuard uses this same code for both "missing" and
 * "expired/invalid" tokens — see jwt-auth.guard.ts), transparently refreshes once via
 * `/auth/refresh` and retries. If there is no refresh token or the refresh itself fails,
 * the session is cleared and `SessionExpiredError` is thrown for the caller to handle.
 */
export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken() ?? undefined;
  try {
    return await apiFetch<T>(path, { ...init, accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "AUTH_UNAUTHENTICATED") {
      throw error;
    }
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      throw new SessionExpiredError();
    }
    try {
      const tokens = await apiFetch<TokenResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
      saveTokens(tokens);
      return await apiFetch<T>(path, { ...init, accessToken: tokens.accessToken });
    } catch {
      clearTokens();
      throw new SessionExpiredError();
    }
  }
}
