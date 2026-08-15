"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileCheck2 } from "lucide-react";
import type {
  MeResponse,
  OrganizationResponse,
  OrganizationVerificationDocumentResponse,
  OrganizationVerificationRequestResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import {
  ORG_TYPE_LABELS,
  ORG_VERIFICATION_DOCUMENT_TYPE_LABELS,
  PLATFORM_ROLE_LABELS,
  VERIFICATION_REQUEST_STATUS_LABELS,
} from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { toneOf, VERIFICATION_REQUEST_STATUS_TONE } from "../../../lib/tone";
import { Card, GhostButton, PageLoader, PrimaryButton, Shell, StatusPill, TextField } from "../../../components/ui";

interface Row {
  request: OrganizationVerificationRequestResponse;
  organization: OrganizationResponse;
  /** `null` = failed to load (per-row, doesn't sink the whole list) — distinct from `[]`,
   * which means "loaded fine, genuinely no documents attached yet". */
  documents: OrganizationVerificationDocumentResponse[] | null;
}

export default function OrganizationVerificationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [retentionDraft, setRetentionDraft] = useState<Record<string, string>>({});
  const [retentionOpenId, setRetentionOpenId] = useState<string | null>(null);
  const [retentionBusyId, setRetentionBusyId] = useState<string | null>(null);

  async function load() {
    const requests = await authFetch<OrganizationVerificationRequestResponse[]>(
      "/platform/organization-verifications",
    );
    const organizations = await Promise.all(
      requests.map((request) => authFetch<OrganizationResponse>(`/organizations/${request.organizationId}`)),
    );
    const documentResults = await Promise.allSettled(
      requests.map((request) =>
        authFetch<OrganizationVerificationDocumentResponse[]>(
          `/platform/organization-verifications/${request.id}/documents`,
        ),
      ),
    );
    setRows(
      requests.map((request, index) => {
        const documentResult = documentResults[index]!;
        return {
          request,
          organization: organizations[index]!,
          documents: documentResult.status === "fulfilled" ? documentResult.value : null,
        };
      }),
    );
  }

  async function onViewDocument(requestId: string, documentId: string) {
    try {
      // Re-fetch instead of using the cached URL — signed URLs expire, and the row may
      // have been sitting on screen for a while before the reviewer clicks "Xem".
      const documents = await authFetch<OrganizationVerificationDocumentResponse[]>(
        `/platform/organization-verifications/${requestId}/documents`,
      );
      const fresh = documents.find((doc) => doc.id === documentId);
      if (fresh) {
        window.open(fresh.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không mở được tài liệu.");
    }
  }

  function onSetRetention(documentId: string) {
    const date = retentionDraft[documentId];
    if (!date) return;
    setRetentionBusyId(documentId);
    setError(null);
    authFetch(`/platform/verification-documents/${documentId}/retention`, {
      method: "POST",
      body: JSON.stringify({ retentionUntil: new Date(`${date}T00:00:00Z`).toISOString() }),
    })
      .then(() => setRetentionOpenId(null))
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không đặt được hạn lưu trữ.");
      })
      .finally(() => setRetentionBusyId(null));
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
        setError("Không tải được danh sách hồ sơ chờ duyệt.");
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
      await authFetch(`/platform/organization-verifications/${requestId}/claim`, { method: "POST" });
      await load();
    });
  }

  function onApprove(requestId: string) {
    return withBusy(requestId, async () => {
      await authFetch(`/platform/organization-verifications/${requestId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: "APPROVE" }),
      });
      await load();
    });
  }

  function onReject(requestId: string) {
    if (!rejectNote.trim()) return Promise.resolve();
    return withBusy(requestId, async () => {
      await authFetch(`/platform/organization-verifications/${requestId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: "REJECT", reviewerNote: rejectNote.trim() }),
      });
      setRejectingId(null);
      setRejectNote("");
      await load();
    });
  }

  if (!me) return <PageLoader />;
  const nav = navForPersona("platform-ops", me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 22 }}>Yêu cầu xác minh tổ chức</h1>
        <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-slate-500)", marginBottom: "var(--space-5)" }}>
          Hồ sơ tổ chức đang chờ hoặc đang được thẩm định. Nhận xử lý một hồ sơ trước khi có thể
          duyệt hoặc từ chối.
        </p>

        {error && (
          <p className="uikit-alert-error" role="alert" style={{ marginBottom: "var(--space-5)" }}>
            {error}
          </p>
        )}

        <Card>
          {rows === null ? null : rows.length === 0 ? (
            <p className="uikit-empty">Không có hồ sơ tổ chức nào đang chờ xử lý.</p>
          ) : (
            <div className="uikit-stack">
              {rows.slice(0, visibleCount).map(({ request, organization, documents }) => {
                const isBusy = busyId === request.id;
                const claimedByMe = request.reviewerUserId === me.userId;

                return (
                  <div
                    key={request.id}
                    style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-4)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{organization.name}</p>
                        <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>
                          {ORG_TYPE_LABELS[organization.type]} · Nộp lúc{" "}
                          {new Date(request.submittedAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <StatusPill tone={toneOf(VERIFICATION_REQUEST_STATUS_TONE, request.status)}>
                        {VERIFICATION_REQUEST_STATUS_LABELS[request.status] ?? request.status}
                      </StatusPill>
                    </div>

                    <div style={{ marginTop: "var(--space-4)" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)", marginBottom: "var(--space-2)" }}>
                        Tài liệu đính kèm
                      </p>
                      {documents === null ? (
                        <p style={{ fontSize: 13, color: "var(--uikit-slate-400)" }}>
                          Không tải được tài liệu — thử tải lại trang.
                        </p>
                      ) : documents.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--uikit-amber-700)" }}>Chưa có tài liệu đính kèm.</p>
                      ) : (
                        <div className="uikit-stack" style={{ gap: "var(--space-2)" }}>
                          {documents.map((doc) => (
                            <div key={doc.id}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13 }}>
                                  <FileCheck2 size={16} />
                                  {ORG_VERIFICATION_DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType} ·{" "}
                                  {doc.originalFilename}
                                </span>
                                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                  {me.platformRole === "PLATFORM_ADMIN" && (
                                    <GhostButton onClick={() => setRetentionOpenId((id) => (id === doc.id ? null : doc.id))}>
                                      Hạn lưu trữ
                                    </GhostButton>
                                  )}
                                  <GhostButton icon={ExternalLink} onClick={() => onViewDocument(request.id, doc.id)}>
                                    Xem
                                  </GhostButton>
                                </div>
                              </div>
                              {retentionOpenId === doc.id && (
                                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginTop: "var(--space-2)" }}>
                                  <input
                                    type="date"
                                    value={retentionDraft[doc.id] ?? ""}
                                    onChange={(e) => setRetentionDraft((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                                    style={{
                                      padding: "6px 10px",
                                      border: "1px solid var(--uikit-slate-200)",
                                      borderRadius: "var(--radius-sm)",
                                      fontSize: 13,
                                    }}
                                  />
                                  <PrimaryButton disabled={retentionBusyId === doc.id || !retentionDraft[doc.id]} onClick={() => onSetRetention(doc.id)}>
                                    {retentionBusyId === doc.id ? "Đang lưu…" : "Lưu hạn"}
                                  </PrimaryButton>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
                      {request.status === "PENDING" && (
                        <PrimaryButton disabled={isBusy} onClick={() => onClaim(request.id)}>
                          {isBusy ? "Đang xử lý…" : "Nhận xử lý"}
                        </PrimaryButton>
                      )}

                      {request.status === "IN_REVIEW" && claimedByMe && rejectingId !== request.id && (
                        <>
                          <PrimaryButton disabled={isBusy} onClick={() => onApprove(request.id)}>
                            {isBusy ? "Đang xử lý…" : "Duyệt · Kích hoạt tổ chức"}
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

        {(rows?.length ?? 0) > visibleCount && (
          <GhostButton onClick={() => setVisibleCount((n) => n + 20)} style={{ marginTop: "var(--space-4)" }}>
            Xem thêm ({(rows?.length ?? 0) - visibleCount} còn lại)
          </GhostButton>
        )}
      </div>
    </Shell>
  );
}
