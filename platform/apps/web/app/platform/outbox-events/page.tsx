"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse, OutboxEventResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { Card, GhostButton, PageLoader, PrimaryButton, SelectField, Shell, StatusPill } from "../../../components/ui";

const PAGE_SIZE = 50;
const STATUS_OPTIONS = [
  { value: "DEAD_LETTER", label: "Lỗi vĩnh viễn (DEAD_LETTER)" },
  { value: "FAILED", label: "Đang lỗi, sẽ tự thử lại (FAILED)" },
  { value: "PENDING", label: "Đang chờ xử lý (PENDING)" },
  { value: "PUBLISHED", label: "Đã xử lý xong (PUBLISHED)" },
  { value: "", label: "Tất cả" },
];

export default function AdminOutboxEventsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [events, setEvents] = useState<OutboxEventResponse[] | null>(null);
  const [status, setStatus] = useState("DEAD_LETTER");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(offset: number, statusFilter: string) {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (statusFilter) qs.set("status", statusFilter);
    const rows = await authFetch<OutboxEventResponse[]>(`/platform/outbox-events?${qs}`);
    setEvents((prev) => (offset === 0 ? rows : [...(prev ?? []), ...rows]));
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
        await loadPage(0, "DEAD_LETTER");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được hàng đợi tác vụ.");
      });
    // Intentionally runs once on mount.
  }, []);

  function onStatusChange(next: string) {
    setStatus(next);
    setEvents(null);
    loadPage(0, next).catch((err) => setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không lọc được."));
  }

  function onLoadMore() {
    setLoadingMore(true);
    loadPage(events?.length ?? 0, status)
      .catch((err) => setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải thêm được."))
      .finally(() => setLoadingMore(false));
  }

  function onRetry(id: string) {
    setBusyId(id);
    setError(null);
    authFetch(`/platform/outbox-events/${id}/retry`, { method: "POST" })
      .then(() => loadPage(0, status))
      .catch((err) => setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thử lại thất bại."))
      .finally(() => setBusyId(null));
  }

  if (!me) return <PageLoader />;
  const nav = navForPersona("platform-ops", true);

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <h1 style={{ fontSize: 22 }}>Hàng đợi tác vụ lỗi</h1>
        <p style={{ fontSize: 14, color: "var(--uikit-slate-500)" }}>
          Sự kiện nền (gửi email, đồng bộ...) đã lỗi. "Lỗi vĩnh viễn" nghĩa là hệ thống đã tự thử lại nhiều lần và bỏ cuộc — bấm "Thử lại" để đưa vào hàng đợi xử lý lần nữa.
        </p>

        <div style={{ maxWidth: 320 }}>
          <SelectField label="Trạng thái" value={status} onChange={(e) => onStatusChange(e.target.value)} options={STATUS_OPTIONS} />
        </div>

        {error && (
          <p className="uikit-alert-error" role="alert">
            {error}
          </p>
        )}

        <Card>
          {events === null ? null : events.length === 0 ? (
            <p className="uikit-empty">Không có sự kiện nào khớp bộ lọc.</p>
          ) : (
            <div className="uikit-row-list">
              {events.map((ev) => (
                <div key={ev.id} className="uikit-row" style={{ alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontWeight: 500, fontSize: 14, fontFamily: "var(--font-mono)" }}>{ev.eventType}</p>
                    <p style={{ marginTop: 2, fontSize: 12, color: "var(--uikit-slate-500)" }}>
                      {ev.aggregateType} · {ev.aggregateId.slice(0, 8)} · {ev.attemptCount} lần thử · {new Date(ev.createdAt).toLocaleString("vi-VN")}
                    </p>
                    {ev.lastError && (
                      <p style={{ marginTop: 4, fontSize: 12, color: "var(--uikit-rose-700)", fontFamily: "var(--font-mono)", maxWidth: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ev.lastError}>
                        {ev.lastError}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
                    <StatusPill tone={ev.status === "DEAD_LETTER" ? "red" : ev.status === "PUBLISHED" ? "green" : "amber"}>{ev.status}</StatusPill>
                    {ev.status === "DEAD_LETTER" && (
                      <PrimaryButton disabled={busyId === ev.id} onClick={() => onRetry(ev.id)}>
                        {busyId === ev.id ? "Đang thử…" : "Thử lại"}
                      </PrimaryButton>
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
