"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCheck } from "lucide-react";
import type { MeResponse, NotificationResponse, OrganizationResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { Card, GhostButton, PageLoader, PrimaryButton, Shell, StatusDot } from "../../components/ui";

export default function NotificationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [notifications, setNotifications] = useState<NotificationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  async function load() {
    const rows = await authFetch<NotificationResponse[]>("/notifications");
    setNotifications(rows);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([authFetch<MeResponse>("/me"), authFetch<OrganizationResponse[]>("/organizations")])
      .then(async ([meResponse, orgs]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        await load();
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được danh sách thông báo.");
      });
    // Intentionally runs once on mount — `load` closes over state that would otherwise
    // cause a dependency-array footgun; router/getAccessToken don't change across renders.
  }, []);

  async function onMarkRead(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await authFetch("/notifications/read", { method: "POST", body: JSON.stringify({ ids: [id] }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại, vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDismiss(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await authFetch("/notifications/dismiss", { method: "POST", body: JSON.stringify({ ids: [id] }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại, vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  }

  async function onMarkAllRead() {
    if (!notifications) return;
    const unreadIds = notifications.filter((n) => n.status === "UNREAD").map((n) => n.id);
    if (unreadIds.length === 0) return;
    setBusyAll(true);
    setError(null);
    try {
      await authFetch("/notifications/read", { method: "POST", body: JSON.stringify({ ids: unreadIds }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại, vui lòng thử lại.");
    } finally {
      setBusyAll(false);
    }
  }

  if (!me || !organizations) return <PageLoader />;
  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");
  const visible = (notifications ?? []).filter((n) => n.status !== "ARCHIVED");
  const unreadCount = visible.filter((n) => n.status === "UNREAD").length;

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22 }}>Thông báo</h1>
            <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-slate-500)" }}>
              Thông báo hoạt động liên quan tới bạn.
            </p>
          </div>
          {unreadCount > 0 && (
            <GhostButton icon={CheckCheck} disabled={busyAll} onClick={onMarkAllRead}>
              {busyAll ? "Đang xử lý…" : "Đánh dấu tất cả đã đọc"}
            </GhostButton>
          )}
        </div>

        {error && (
          <p className="uikit-alert-error" role="alert" style={{ marginTop: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            {error}
          </p>
        )}

        <Card style={{ marginTop: "var(--space-5)" }}>
          {notifications === null ? null : visible.length === 0 ? (
            <p className="uikit-empty">Bạn không có thông báo nào.</p>
          ) : (
            <div className="uikit-stack">
              {visible.map((n) => {
                const isBusy = busyId === n.id;
                return (
                  <div
                    key={n.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "var(--space-4)",
                      border: "1px solid var(--uikit-slate-200)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--space-4)",
                      background: n.status === "UNREAD" ? "var(--uikit-slate-50)" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                      {n.status === "UNREAD" && <StatusDot tone="blue" label="" />}
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</p>
                        <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>{n.message}</p>
                        <p style={{ marginTop: 4, fontSize: 12, color: "var(--uikit-slate-400)" }}>
                          {new Date(n.createdAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                      {n.status === "UNREAD" && (
                        <PrimaryButton disabled={isBusy} onClick={() => onMarkRead(n.id)}>
                          {isBusy ? "…" : "Đã đọc"}
                        </PrimaryButton>
                      )}
                      <GhostButton icon={Archive} disabled={isBusy} onClick={() => onDismiss(n.id)}>
                        Đóng
                      </GhostButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
