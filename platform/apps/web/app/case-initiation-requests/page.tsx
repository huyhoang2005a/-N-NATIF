"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseInitiationRequestResponse, MeResponse, OrganizationResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { CASE_INITIATION_STATUS_LABELS, PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { CASE_INITIATION_STATUS_TONE, toneOf } from "../../lib/tone";
import { Card, GhostButton, PrimaryButton, Shell, StatusPill, TextField } from "../../components/ui";

export default function CaseInitiationRequestsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [requests, setRequests] = useState<CaseInitiationRequestResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<CaseInitiationRequestResponse[]>("/case-initiation-requests"),
    ])
      .then(([meResponse, orgs, rows]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        setRequests(rows);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setLoadError("Không tải được danh sách yêu cầu khởi tạo case.");
      });
  }, [router]);

  function onAccept(id: string) {
    setActionBusy(id);
    setActionError(null);
    authFetch<CaseInitiationRequestResponse>(`/case-initiation-requests/${id}/accept`, { method: "POST" })
      .then((updated) => {
        setRequests((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Chấp nhận yêu cầu thất bại.");
      })
      .finally(() => setActionBusy(null));
  }

  function onDecline(id: string) {
    setActionBusy(id);
    setActionError(null);
    authFetch<CaseInitiationRequestResponse>(`/case-initiation-requests/${id}/decline`, {
      method: "POST",
      body: JSON.stringify({ responseNote: declineNote || undefined }),
    })
      .then((updated) => {
        setRequests((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
        setDecliningId(null);
        setDeclineNote("");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Từ chối yêu cầu thất bại.");
      })
      .finally(() => setActionBusy(null));
  }

  if (loadError) {
    return (
      <div className="uikit-main" style={{ maxWidth: 720, margin: "0 auto" }}>
        <p className="uikit-alert-error" role="alert">
          {loadError}
        </p>
      </div>
    );
  }

  if (!me || !organizations || !requests) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <h1 style={{ fontSize: 22 }}>Yêu cầu khởi tạo case</h1>
        <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
          Các doanh nghiệp quan tâm đến tài nguyên của bạn qua gợi ý AI có thể gửi yêu cầu
          khởi tạo Technology Case — chấp nhận sẽ tự động tạo case với bạn là chủ trì.
        </p>

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        <Card>
          {requests.length === 0 ? (
            <p className="uikit-empty">Chưa có yêu cầu khởi tạo case nào.</p>
          ) : (
            <div className="uikit-stack">
              {requests.map((r) => (
                <div key={r.id} style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
                    <span style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>
                      Yêu cầu ngày {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    <StatusPill tone={toneOf(CASE_INITIATION_STATUS_TONE, r.status)}>
                      {CASE_INITIATION_STATUS_LABELS[r.status] ?? r.status}
                    </StatusPill>
                  </div>
                  {r.message && <p style={{ marginTop: "var(--space-2)", fontSize: 13 }}>{r.message}</p>}
                  {r.expiresAt && r.status === "PENDING" && (
                    <p style={{ marginTop: "var(--space-2)", fontSize: 12, color: "var(--uikit-slate-500)" }}>
                      Hết hạn: {new Date(r.expiresAt).toLocaleDateString("vi-VN")}
                    </p>
                  )}
                  {r.responseNote && <p style={{ marginTop: "var(--space-2)", fontSize: 12, color: "var(--uikit-slate-500)" }}>Ghi chú: {r.responseNote}</p>}

                  {r.status === "PENDING" && (
                    <div style={{ marginTop: "var(--space-3)" }}>
                      {decliningId !== r.id ? (
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <PrimaryButton disabled={actionBusy === r.id} onClick={() => onAccept(r.id)}>
                            {actionBusy === r.id ? "Đang xử lý…" : "Chấp nhận → tạo Case"}
                          </PrimaryButton>
                          <GhostButton tone="red" onClick={() => setDecliningId(r.id)}>
                            Từ chối
                          </GhostButton>
                        </div>
                      ) : (
                        <div className="uikit-stack">
                          <TextField label="Ghi chú (tuỳ chọn)" as="textarea" optional value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} />
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <PrimaryButton disabled={actionBusy === r.id} onClick={() => onDecline(r.id)}>
                              {actionBusy === r.id ? "Đang gửi…" : "Xác nhận từ chối"}
                            </PrimaryButton>
                            <GhostButton onClick={() => { setDecliningId(null); setDeclineNote(""); }}>Huỷ</GhostButton>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
