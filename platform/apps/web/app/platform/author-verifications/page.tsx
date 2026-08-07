"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthorVerificationRequestResponse, MeResponse, OrganizationResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS, VERIFICATION_REQUEST_STATUS_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { toneOf, VERIFICATION_REQUEST_STATUS_TONE } from "../../../lib/tone";
import { Card, GhostButton, PrimaryButton, Shell, StatusPill, TextField } from "../../../components/ui";

interface PresignedUrlResponse {
  url: string;
  expiresIn: number;
}

export default function AuthorVerificationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [requests, setRequests] = useState<AuthorVerificationRequestResponse[] | null>(null);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function load() {
    const rows = await authFetch<AuthorVerificationRequestResponse[]>("/platform/author-verifications");
    setRequests(rows);
    const uniqueOrgIds = Array.from(new Set(rows.map((r) => r.affiliationOrgId)));
    const orgs = await Promise.all(uniqueOrgIds.map((id) => authFetch<OrganizationResponse>(`/organizations/${id}`)));
    setOrgNames(Object.fromEntries(orgs.map((o) => [o.id, o.name])));
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    authFetch<MeResponse>("/me")
      .then(async (meResponse) => {
        if (meResponse.platformRole === "USER") {
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
        setError("Không tải được danh sách yêu cầu xác minh tác giả.");
      });
    // Intentionally runs once on mount — `load` closes over state that would otherwise
    // cause a dependency-array footgun; router/getAccessToken don't change across renders.
  }, []);

  async function withBusy(requestId: string, action: () => Promise<void>) {
    setBusyId(requestId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại, vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  }

  function onClaim(requestId: string) {
    return withBusy(requestId, async () => {
      await authFetch(`/platform/author-verifications/${requestId}/claim`, { method: "POST" });
      await load();
    });
  }

  function onApprove(requestId: string) {
    return withBusy(requestId, async () => {
      await authFetch(`/platform/author-verifications/${requestId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: "APPROVE" }),
      });
      await load();
    });
  }

  function onReject(requestId: string) {
    if (!rejectNote.trim()) return Promise.resolve();
    return withBusy(requestId, async () => {
      await authFetch(`/platform/author-verifications/${requestId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: "REJECT", reviewerNote: rejectNote.trim() }),
      });
      setRejectingId(null);
      setRejectNote("");
      await load();
    });
  }

  async function onViewDocument(requestId: string) {
    const { url } = await authFetch<PresignedUrlResponse>(`/platform/author-verifications/${requestId}/document-url`);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!me) return null;

  const nav = navForPersona("platform-ops", me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 22 }}>Yêu cầu xác minh tác giả</h1>
        <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-slate-500)", marginBottom: "var(--space-5)" }}>
          Yêu cầu xác minh danh tính tác giả đang chờ hoặc đang được thẩm định.
        </p>

        {error && (
          <p className="uikit-alert-error" role="alert" style={{ marginBottom: "var(--space-5)" }}>
            {error}
          </p>
        )}

        <Card>
          {requests === null ? null : requests.length === 0 ? (
            <p className="uikit-empty">Không có yêu cầu xác minh tác giả nào đang chờ xử lý.</p>
          ) : (
            <div className="uikit-stack">
              {requests.map((request) => {
                const isBusy = busyId === request.id;
                const claimedByMe = request.reviewerUserId === me.userId;

                return (
                  <div
                    key={request.id}
                    style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-4)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, fontFamily: "var(--font-mono)" }}>
                          Tác giả {request.authorUserId.slice(0, 8)}
                        </p>
                        <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>
                          {orgNames[request.affiliationOrgId] ?? "—"} · Nộp lúc{" "}
                          {new Date(request.submittedAt).toLocaleString("vi-VN")}
                        </p>
                        {request.submittedNote && (
                          <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>{request.submittedNote}</p>
                        )}
                      </div>
                      <StatusPill tone={toneOf(VERIFICATION_REQUEST_STATUS_TONE, request.status)}>
                        {VERIFICATION_REQUEST_STATUS_LABELS[request.status] ?? request.status}
                      </StatusPill>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
                      <GhostButton onClick={() => onViewDocument(request.id)}>Xem tài liệu</GhostButton>

                      {request.status === "PENDING" && (
                        <PrimaryButton disabled={isBusy} onClick={() => onClaim(request.id)}>
                          {isBusy ? "Đang xử lý…" : "Nhận xử lý"}
                        </PrimaryButton>
                      )}

                      {request.status === "IN_REVIEW" && claimedByMe && rejectingId !== request.id && (
                        <>
                          <PrimaryButton disabled={isBusy} onClick={() => onApprove(request.id)}>
                            {isBusy ? "Đang xử lý…" : "Duyệt xác minh"}
                          </PrimaryButton>
                          <GhostButton
                            tone="red"
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingId(request.id);
                              setRejectNote("");
                            }}
                          >
                            Từ chối
                          </GhostButton>
                        </>
                      )}

                      {request.status === "IN_REVIEW" && !claimedByMe && (
                        <span style={{ fontSize: 13, color: "var(--uikit-slate-400)" }}>
                          Đang được kiểm định viên khác xử lý.
                        </span>
                      )}
                    </div>

                    {request.status === "IN_REVIEW" && claimedByMe && rejectingId === request.id && (
                      <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
                        <TextField
                          label="Lý do từ chối"
                          as="textarea"
                          required
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                        />
                        <div style={{ display: "flex", gap: "var(--space-3)" }}>
                          <PrimaryButton disabled={isBusy || !rejectNote.trim()} onClick={() => onReject(request.id)}>
                            {isBusy ? "Đang xử lý…" : "Xác nhận từ chối"}
                          </PrimaryButton>
                          <GhostButton
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingId(null);
                              setRejectNote("");
                            }}
                          >
                            Huỷ
                          </GhostButton>
                        </div>
                      </div>
                    )}
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
