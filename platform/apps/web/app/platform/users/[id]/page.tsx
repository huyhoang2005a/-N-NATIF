"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { MeResponse, PlatformUserDetailResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../../lib/api-client";
import { describeErrorCode } from "../../../../lib/error-messages";
import { ORG_MEMBER_ROLE_LABELS, PLATFORM_ROLE_LABELS, USER_STATUS_LABELS } from "../../../../lib/labels";
import { navForPersona } from "../../../../lib/nav";
import { getAccessToken } from "../../../../lib/session";
import { toneOf, USER_STATUS_TONE } from "../../../../lib/tone";
import { BackLink, Card, GhostButton, PageLoader, PrimaryButton, SectionHeader, Shell, StatusDot, StatusPill, TextField } from "../../../../components/ui";

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [user, setUser] = useState<PlatformUserDetailResponse | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  async function load() {
    setUser(await authFetch<PlatformUserDetailResponse>(`/platform/users/${userId}`));
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
        await load();
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được thông tin người dùng.");
      });
    // Intentionally runs once on mount.
  }, []);

  function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key);
    setError(null);
    action()
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại.");
      })
      .finally(() => setBusyKey(null));
  }

  function onSuspend() {
    runAction("suspend", async () => {
      await authFetch(`/platform/users/${userId}/suspend`, { method: "POST", body: JSON.stringify({ reason: suspendReason }) });
      setSuspendReason("");
      setShowSuspendForm(false);
      await load();
    });
  }

  function onReactivate() {
    runAction("reactivate", async () => {
      await authFetch(`/platform/users/${userId}/reactivate`, { method: "POST" });
      await load();
    });
  }

  if (!me) return <PageLoader />;
  const nav = navForPersona("platform-ops", true);

  if (!user) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
        <PageLoader inline />
      </Shell>
    );
  }

  const isSelf = user.userId === me.userId;

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <BackLink href="/platform/users">Quay lại danh sách người dùng</BackLink>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <div>
            <h1 style={{ fontSize: 22 }}>{user.displayName ?? user.primaryEmail}</h1>
            <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--uikit-slate-500)" }}>
              {user.primaryEmail} · {PLATFORM_ROLE_LABELS[user.platformRole] ?? user.platformRole} · Tạo lúc{" "}
              {new Date(user.createdAt).toLocaleDateString("vi-VN")}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {!user.emailVerified && <StatusPill tone="amber">Email chưa xác thực</StatusPill>}
            <StatusDot tone={toneOf(USER_STATUS_TONE, user.status)} label={USER_STATUS_LABELS[user.status] ?? user.status} />
          </div>
        </div>

        {error && (
          <p className="uikit-alert-error" role="alert">
            {error}
          </p>
        )}

        <Card>
          <SectionHeader title="Quản trị" />
          {isSelf ? (
            <p style={{ fontSize: 13, color: "var(--uikit-slate-400)" }}>Không thể tự khoá tài khoản của chính mình.</p>
          ) : (
            <>
              {user.status === "ACTIVE" && (
                <div className="uikit-stack">
                  {!showSuspendForm ? (
                    <GhostButton tone="red" onClick={() => setShowSuspendForm(true)}>
                      Tạm khoá tài khoản
                    </GhostButton>
                  ) : (
                    <>
                      <TextField
                        label="Lý do tạm khoá"
                        as="textarea"
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        hint="Bắt buộc — lưu vào nhật ký hệ thống."
                      />
                      <div style={{ display: "flex", gap: "var(--space-3)" }}>
                        <PrimaryButton disabled={busyKey === "suspend" || !suspendReason.trim()} onClick={onSuspend}>
                          {busyKey === "suspend" ? "Đang xử lý…" : "Xác nhận tạm khoá"}
                        </PrimaryButton>
                        <GhostButton onClick={() => setShowSuspendForm(false)}>Huỷ</GhostButton>
                      </div>
                    </>
                  )}
                </div>
              )}
              {user.status === "SUSPENDED" && (
                <PrimaryButton disabled={busyKey === "reactivate"} onClick={onReactivate}>
                  {busyKey === "reactivate" ? "Đang xử lý…" : "Mở khoá tài khoản"}
                </PrimaryButton>
              )}
              {user.status !== "ACTIVE" && user.status !== "SUSPENDED" && (
                <p style={{ fontSize: 13, color: "var(--uikit-slate-400)" }}>
                  Không thể tạm khoá/mở khoá ở trạng thái hiện tại ({USER_STATUS_LABELS[user.status] ?? user.status}).
                </p>
              )}
            </>
          )}
        </Card>

        <Card>
          <SectionHeader title="Tổ chức tham gia" />
          {user.organizationMemberships.length === 0 ? (
            <p className="uikit-empty">Người dùng chưa tham gia tổ chức nào.</p>
          ) : (
            <div className="uikit-row-list">
              {user.organizationMemberships.map((m) => (
                <Link key={m.organizationId} href={`/platform/organizations/${m.organizationId}`} className="uikit-row-link">
                  <span style={{ fontSize: 14 }}>{m.organizationName}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>{ORG_MEMBER_ROLE_LABELS[m.role] ?? m.role}</span>
                    <StatusDot tone={m.status === "ACTIVE" ? "green" : "gray"} label={m.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
