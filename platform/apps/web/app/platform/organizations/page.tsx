"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS, PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { toneOf, ORGANIZATION_STATUS_TONE } from "../../../lib/tone";
import { Card, GhostButton, PageLoader, RemoveButton, Shell, StatusDot } from "../../../components/ui";

const PAGE_SIZE = 50;

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadPage(offset: number) {
    const rows = await authFetch<OrganizationResponse[]>(`/platform/organizations?limit=${PAGE_SIZE}&offset=${offset}`);
    setOrganizations((prev) => (offset === 0 ? rows : [...(prev ?? []), ...rows]));
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
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được danh sách tổ chức.");
      });
    // Intentionally runs once on mount — router/getAccessToken don't change across renders.
  }, []);

  function onSuspend(orgId: string) {
    return authFetch<OrganizationResponse>(`/platform/organizations/${orgId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason: "Tạm khoá nhanh từ danh sách quản trị." }),
    }).then((updated) => {
      setOrganizations((prev) => (prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev));
    });
  }

  function onLoadMore() {
    setLoadingMore(true);
    loadPage(organizations?.length ?? 0)
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
        <h1 style={{ fontSize: 22 }}>Tổ chức</h1>
        <p style={{ fontSize: 14, color: "var(--uikit-slate-500)" }}>Toàn bộ tổ chức đã đăng ký trên nền tảng, mới nhất trước.</p>

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
          {organizations === null ? null : organizations.length === 0 ? (
            <p className="uikit-empty">Chưa có tổ chức nào trên nền tảng.</p>
          ) : (
            <div className="uikit-row-list">
              {organizations.map((org) => (
                <div key={org.id} className="uikit-row">
                  <Link href={`/platform/organizations/${org.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <p style={{ fontWeight: 500, fontSize: 14 }}>{org.name}</p>
                    <p style={{ marginTop: 2, fontSize: 12, color: "var(--uikit-slate-500)" }}>
                      {ORG_TYPE_LABELS[org.type]} · {new Date(org.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </Link>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <StatusDot tone={toneOf(ORGANIZATION_STATUS_TONE, org.status)} label={ORG_STATUS_LABELS[org.status] ?? org.status} />
                    {org.status === "ACTIVE" && (
                      <RemoveButton
                        label="Tạm khoá tổ chức"
                        confirmLabel="Tạm khoá tổ chức này?"
                        onRemove={() => onSuspend(org.id)}
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
