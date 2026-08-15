"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuditLogEntryResponse, MeResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { fetchUserNames } from "../../../lib/user-lookup";
import { Card, GhostButton, PageLoader, Shell, TextField } from "../../../components/ui";

const PAGE_SIZE = 50;

export default function AdminAuditLogPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [entries, setEntries] = useState<AuditLogEntryResponse[] | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(offset: number, entityType: string) {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (entityType) qs.set("entityType", entityType);
    const rows = await authFetch<AuditLogEntryResponse[]>(`/platform/audit-log?${qs}`);
    setEntries((prev) => (offset === 0 ? rows : [...(prev ?? []), ...rows]));
    setHasMore(rows.length === PAGE_SIZE);
    fetchUserNames(rows.map((r) => r.actorUserId).filter((id): id is string => Boolean(id))).then((names) =>
      setUserNames((prev) => ({ ...prev, ...names })),
    );
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
        await loadPage(0, "");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được nhật ký hệ thống.");
      });
    // Intentionally runs once on mount.
  }, []);

  function onFilter() {
    setEntries(null);
    loadPage(0, entityTypeFilter).catch((err) => {
      setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không lọc được.");
    });
  }

  function onLoadMore() {
    setLoadingMore(true);
    loadPage(entries?.length ?? 0, entityTypeFilter)
      .catch((err) => setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải thêm được."))
      .finally(() => setLoadingMore(false));
  }

  if (!me) return <PageLoader />;
  const nav = navForPersona("platform-ops", true);

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <h1 style={{ fontSize: 22 }}>Nhật ký hệ thống</h1>
        <p style={{ fontSize: 14, color: "var(--uikit-slate-500)" }}>
          Toàn bộ thay đổi trên nền tảng (audit log), mới nhất trước. Bấm vào một dòng để xem chi tiết trước/sau.
        </p>

        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", maxWidth: 420 }}>
          <TextField
            label="Lọc theo loại thực thể"
            optional
            placeholder="vd: organization, user_account, gap_record…"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
          />
          <GhostButton onClick={onFilter}>Lọc</GhostButton>
        </div>

        {error && (
          <p className="uikit-alert-error" role="alert">
            {error}
          </p>
        )}

        <Card>
          {entries === null ? null : entries.length === 0 ? (
            <p className="uikit-empty">Không có bản ghi nào khớp bộ lọc.</p>
          ) : (
            <div className="uikit-row-list">
              {entries.map((entry) => (
                <div key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
                    className="uikit-row"
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <div>
                      <p style={{ fontWeight: 500, fontSize: 14, fontFamily: "var(--font-mono)" }}>{entry.action}</p>
                      <p style={{ marginTop: 2, fontSize: 12, color: "var(--uikit-slate-500)" }}>
                        {entry.entityType} · {entry.entityId.slice(0, 8)} ·{" "}
                        {entry.actorUserId ? (userNames[entry.actorUserId] ?? entry.actorUserId.slice(0, 8)) : "Hệ thống"}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>{new Date(entry.createdAt).toLocaleString("vi-VN")}</span>
                  </button>
                  {expandedId === entry.id && (
                    <div style={{ padding: "var(--space-3)", background: "var(--uikit-slate-50)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-2)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--uikit-slate-500)", marginBottom: 4 }}>TRƯỚC</p>
                          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)" }}>
                            {entry.beforeData ? JSON.stringify(entry.beforeData, null, 2) : "—"}
                          </pre>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--uikit-slate-500)", marginBottom: 4 }}>SAU</p>
                          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)" }}>
                            {entry.afterData ? JSON.stringify(entry.afterData, null, 2) : "—"}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
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
