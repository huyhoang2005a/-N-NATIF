"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  MeResponse,
  OrganizationResponse,
  OrganizationVerificationRequestResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { ORG_TYPE_LABELS, VERIFICATION_REQUEST_STATUS_LABELS } from "../../../lib/labels";
import { getAccessToken } from "../../../lib/session";
import { SiteHeader } from "../../_components/SiteHeader";

interface Row {
  request: OrganizationVerificationRequestResponse;
  organization: OrganizationResponse;
}

export default function OrganizationVerificationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function load() {
    const requests = await authFetch<OrganizationVerificationRequestResponse[]>(
      "/platform/organization-verifications",
    );
    const organizations = await Promise.all(
      requests.map((request) => authFetch<OrganizationResponse>(`/organizations/${request.organizationId}`)),
    );
    setRows(requests.map((request, index) => ({ request, organization: organizations[index] })));
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

  return (
    <div className="shell">
      <SiteHeader />
      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)", maxWidth: 860 }}>
        <span className="eyebrow">Chuyên viên thẩm định</span>
        <h1 style={{ fontSize: 30, marginTop: "var(--space-4)" }}>Xét duyệt tổ chức</h1>
        <p style={{ marginTop: "var(--space-3)", fontSize: 14, color: "var(--ink-700)" }}>
          Hồ sơ tổ chức đang chờ hoặc đang được thẩm định. Nhận xử lý một hồ sơ trước khi có thể duyệt hoặc
          từ chối.
        </p>

        {error && (
          <p className="alert alert-error" role="alert" style={{ marginTop: "var(--space-5)" }}>
            {error}
          </p>
        )}

        {rows === null ? null : rows.length === 0 ? (
          <p className="empty-state" style={{ marginTop: "var(--space-5)" }}>
            Không có hồ sơ nào đang chờ xử lý.
          </p>
        ) : (
          <div className="row-list" style={{ marginTop: "var(--space-6)" }}>
            {rows.map(({ request, organization }) => {
              const isBusy = busyId === request.id;
              const claimedByMe = request.reviewerUserId === me?.userId;

              return (
                <div key={request.id} className="row-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                    <div>
                      <strong>{organization.name}</strong>
                      <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--ink-400)" }}>
                        {ORG_TYPE_LABELS[organization.type]} · Nộp lúc{" "}
                        {new Date(request.submittedAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <span className="badge badge-pending">
                      {VERIFICATION_REQUEST_STATUS_LABELS[request.status] ?? request.status}
                    </span>
                  </div>

                  <div className="row-card__actions" style={{ marginTop: "var(--space-4)" }}>
                    {request.status === "PENDING" && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={isBusy}
                        onClick={() => onClaim(request.id)}
                      >
                        {isBusy ? "Đang xử lý…" : "Nhận xử lý"}
                      </button>
                    )}

                    {request.status === "IN_REVIEW" && claimedByMe && rejectingId !== request.id && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={isBusy}
                          onClick={() => onApprove(request.id)}
                        >
                          {isBusy ? "Đang xử lý…" : "Duyệt"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingId(request.id);
                            setRejectNote("");
                          }}
                        >
                          Từ chối
                        </button>
                      </>
                    )}

                    {request.status === "IN_REVIEW" && !claimedByMe && (
                      <span style={{ fontSize: 13, color: "var(--ink-400)" }}>
                        Đang được chuyên viên khác xử lý.
                      </span>
                    )}
                  </div>

                  {request.status === "IN_REVIEW" && claimedByMe && rejectingId === request.id && (
                    <div className="form-stack" style={{ marginTop: "var(--space-4)" }}>
                      <textarea
                        required
                        rows={3}
                        placeholder="Lý do từ chối (bắt buộc)…"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        style={{
                          border: "1px solid var(--ink-200)",
                          borderRadius: "var(--radius-sm)",
                          padding: "11px 13px",
                          fontSize: 14,
                          fontFamily: "inherit",
                          resize: "vertical",
                        }}
                      />
                      <div className="row-card__actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={isBusy || !rejectNote.trim()}
                          onClick={() => onReject(request.id)}
                        >
                          {isBusy ? "Đang xử lý…" : "Xác nhận từ chối"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingId(null);
                            setRejectNote("");
                          }}
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
