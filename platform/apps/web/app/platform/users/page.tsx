"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeResponse, PlatformUserResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS, USER_STATUS_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { toneOf, USER_STATUS_TONE } from "../../../lib/tone";
import { Card, GhostButton, PageLoader, RemoveButton, Shell, StatusDot, StatusPill } from "../../../components/ui";

const PAGE_SIZE = 50;

export default function AdminUsersPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [users, setUsers] = useState<PlatformUserResponse[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadPage(offset: number) {
    const rows = await authFetch<PlatformUserResponse[]>(`/platform/users?limit=${PAGE_SIZE}&offset=${offset}`);
    setUsers((prev) => (offset === 0 ? rows : [...(prev ?? []), ...rows]));
    setHasMore(rows.length === PAGE_SIZE);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    authFetch<MeResponse>("/me")
      .then(async (meResponse) => {
        if (meResponse.platformRole !== "PLATFORM_ADMIN") {
          router.push("/dashboard");
          return;
        }
        setMe(meResponse);
        await loadPage(0);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được danh sách người dùng.");
      });
    // Intentionally runs once on mount — router/getAccessToken don't change across renders.
  }, []);

  function onSuspend(userId: string) {
    return authFetch<PlatformUserResponse>(`/platform/users/${userId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason: "Tạm khoá nhanh từ danh sách quản trị." }),
    }).then((updated) => {
      setUsers((prev) => (prev ? prev.map((u) => (u.userId === updated.userId ? updated : u)) : prev));
    });
  }

  function onLoadMore() {
    setLoadingMore(true);
    loadPage(users?.length ?? 0)
      .catch((err) => {
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải thêm được.");
      })
      .finally(() => setLoadingMore(false));
  }

  if (!me) return <PageLoader />;
  const nav = navForPersona("platform-ops", true);

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <h1 style={{ fontSize: 22 }}>Người dùng</h1>
        <p style={{ fontSize: 14, color: "var(--uikit-slate-500)" }}>Toàn bộ tài khoản trên nền tảng, mới nhất trước.</p>

        {error && (
          <p className="uikit-alert-error" role="alert">
            {error}
          </p>
        )}
        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        <Card>
          {users === null ? null : users.length === 0 ? (
            <p className="uikit-empty">Chưa có người dùng nào trên nền tảng.</p>
          ) : (
            <div className="uikit-row-list">
              {users.map((user) => (
                <div key={user.userId} className="uikit-row">
                  <Link href={`/platform/users/${user.userId}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <p style={{ fontWeight: 500, fontSize: 14 }}>{user.displayName ?? user.primaryEmail}</p>
                    <p style={{ marginTop: 2, fontSize: 12, color: "var(--uikit-slate-500)" }}>
                      {user.primaryEmail} · {PLATFORM_ROLE_LABELS[user.platformRole] ?? user.platformRole} ·{" "}
                      {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </Link>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    {!user.emailVerified && <StatusPill tone="amber">Email chưa xác thực</StatusPill>}
                    <StatusDot tone={toneOf(USER_STATUS_TONE, user.status)} label={USER_STATUS_LABELS[user.status] ?? user.status} />
                    {user.status === "ACTIVE" && user.userId !== me.userId && (
                      <RemoveButton
                        label="Tạm khoá tài khoản"
                        confirmLabel="Tạm khoá tài khoản này?"
                        onRemove={() => onSuspend(user.userId)}
                        onSessionExpired={() => router.push("/login")}
                        onError={setActionError}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {hasMore && (
          <GhostButton disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? "Đang tải…" : "Tải thêm"}
          </GhostButton>
        )}
      </div>
    </Shell>
  );
}
