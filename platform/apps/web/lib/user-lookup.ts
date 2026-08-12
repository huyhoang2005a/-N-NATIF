import type { UserPublicInfoResponse } from "@r2m/contracts";
import { authFetch } from "./api-client";

/** Resolves a batch of userIds to display names via `GET /users/public-info`, so UI that
 * used to show a truncated UUID (case members, verification applicants) can show a real
 * name instead. Returns `{}` on failure — callers should fall back to the UUID, not block
 * the page on this being unavailable. */
export async function fetchUserNames(userIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  if (uniqueIds.length === 0) return {};
  try {
    const rows = await authFetch<UserPublicInfoResponse[]>(`/users/public-info?ids=${uniqueIds.join(",")}`);
    return Object.fromEntries(rows.map((row) => [row.userId, row.displayName]));
  } catch {
    return {};
  }
}
