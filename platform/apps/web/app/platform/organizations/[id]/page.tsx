"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { MeResponse, OrganizationMemberResponse, OrganizationResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../../lib/api-client";
import { describeErrorCode } from "../../../../lib/error-messages";
import { ORG_MEMBER_ROLE_LABELS, ORG_STATUS_LABELS, ORG_TYPE_LABELS, PLATFORM_ROLE_LABELS } from "../../../../lib/labels";
import { navForPersona } from "../../../../lib/nav";
import { getAccessToken } from "../../../../lib/session";
import { toneOf, ORGANIZATION_STATUS_TONE } from "../../../../lib/tone";
import { BackLink, Card, GhostButton, PageLoader, PrimaryButton, SectionHeader, Shell, StatusDot, TextField } from "../../../../components/ui";

export default function AdminOrganizationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orgId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [org, setOrg] = useState<OrganizationResponse | null>(null);
  const [members, setMembers] = useState<OrganizationMemberResponse[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  async function load() {
    const [orgResponse, memberRows] = await Promise.all([
      authFetch<OrganizationResponse>(`/organizations/${orgId}`),
      authFetch<OrganizationMemberResponse[]>(`/platform/organizations/${orgId}/members`),
    ]);
    setOrg(orgResponse);
    setMembers(memberRows);
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
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được thông tin tổ chức.");
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
      await authFetch(`/platform/organizations/${orgId}/suspend`, { method: "POST", body: JSON.stringify({ reason: suspendReason }) });
      setSuspendReason("");
      setShowSuspendForm(false);
      await load();
    });
  }

  function onReactivate() {
    runAction("reactivate", async () => {
      await authFetch(`/platform/organizations/${orgId}/reactivate`, { method: "POST" });
      await load();
    });
  }

  if (!me) return <PageLoader />;
  const nav = navForPersona("platform-ops", true);

  if (!org || !members) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
        <PageLoader inline />
      </Shell>
    );
  }

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <BackLink href="/platform/organizations">Quay lại danh sách tổ chức</BackLink>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <div>
            <h1 style={{ fontSize: 22 }}>{org.name}</h1>
            <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--uikit-slate-500)" }}>
              {ORG_TYPE_LABELS[org.type]} · Tạo lúc {new Date(org.createdAt).toLocaleDateString("vi-VN")}
            </p>
          </div>
          <StatusDot tone={toneOf(ORGANIZATION_STATUS_TONE, org.status)} label={ORG_STATUS_LABELS[org.status] ?? org.status} />
        </div>

        {error && (
          <p className="uikit-alert-error" role="alert">
            {error}
          </p>
        )}

        <Card>
          <SectionHeader title="Quản trị" />
          {org.status === "ACTIVE" && (
            <div className="uikit-stack">
              {!showSuspendForm ? (
                <GhostButton tone="red" onClick={() => setShowSuspendForm(true)}>
                  Tạm khoá tổ chức
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
          {org.status === "SUSPENDED" && (
            <PrimaryButton disabled={busyKey === "reactivate"} onClick={onReactivate}>
              {busyKey === "reactivate" ? "Đang xử lý…" : "Mở khoá tổ chức"}
            </PrimaryButton>
          )}
          {org.status !== "ACTIVE" && org.status !== "SUSPENDED" && (
            <p style={{ fontSize: 13, color: "var(--uikit-slate-400)" }}>
              Không thể tạm khoá/mở khoá ở trạng thái hiện tại ({ORG_STATUS_LABELS[org.status] ?? org.status}).
            </p>
          )}
        </Card>

        <Card>
          <SectionHeader title="Thành viên" />
          {members.length === 0 ? (
            <p className="uikit-empty">Tổ chức chưa có thành viên nào.</p>
          ) : (
            <div className="uikit-row-list">
              {members.map((m) => (
                <div key={m.id} className="uikit-row">
                  <div>
                    <p style={{ fontWeight: 500, fontSize: 14 }}>{m.displayName}</p>
                    <p style={{ marginTop: 2, fontSize: 12, color: "var(--uikit-slate-500)" }}>{m.email}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>{ORG_MEMBER_ROLE_LABELS[m.role] ?? m.role}</span>
                    <StatusDot tone={m.status === "ACTIVE" ? "green" : "gray"} label={m.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
