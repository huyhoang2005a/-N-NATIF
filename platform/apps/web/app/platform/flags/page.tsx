"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentFlagResponse, MeResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import {
  CONTENT_FLAG_STATUS_LABELS,
  MODERATION_ACTION_LABELS,
  MODERATION_TARGET_TYPE_LABELS,
  PLATFORM_ROLE_LABELS,
} from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { CONTENT_FLAG_STATUS_TONE, toneOf } from "../../../lib/tone";
import { Card, GhostButton, PrimaryButton, SelectField, Shell, StatusPill, TextField } from "../../../components/ui";

const DECISION_ACTIONS = ["HIDE", "REMOVE", "RESTRICT_AUTHOR", "RESTORE", "KEEP"] as const;

export default function FlagsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [flags, setFlags] = useState<ContentFlagResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionAction, setDecisionAction] = useState<string>("HIDE");
  const [rationale, setRationale] = useState("");

  async function load() {
    const rows = await authFetch<ContentFlagResponse[]>("/platform/content-flags");
    setFlags(rows);
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
        setError("Không tải được hàng chờ kiểm duyệt.");
      });
    // Intentionally runs once on mount — `load` closes over state that would otherwise
    // cause a dependency-array footgun; router/getAccessToken don't change across renders.
  }, []);

  async function withBusy(flagId: string, action: () => Promise<void>) {
    setBusyId(flagId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại, vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  }

  function onClaim(flagId: string) {
    return withBusy(flagId, async () => {
      await authFetch(`/platform/content-flags/${flagId}/claim`, { method: "POST" });
      await load();
    });
  }

  function onDecide(flagId: string) {
    if (!rationale.trim()) return Promise.resolve();
    return withBusy(flagId, async () => {
      await authFetch(`/platform/content-flags/${flagId}/decision`, {
        method: "POST",
        body: JSON.stringify({ action: decisionAction, rationale: rationale.trim() }),
      });
      setDecidingId(null);
      setRationale("");
      await load();
    });
  }

  if (!me) return null;

  const nav = navForPersona("platform-ops", me.platformRole === "PLATFORM_ADMIN");
  const openFlags = (flags ?? []).filter((f) => f.status === "PENDING" || f.status === "IN_REVIEW");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 22 }}>Kiểm duyệt nội dung</h1>
        <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-slate-500)", marginBottom: "var(--space-5)" }}>
          Báo cáo nội dung đang chờ hoặc đang được xử lý.
        </p>

        {error && (
          <p className="uikit-alert-error" role="alert" style={{ marginBottom: "var(--space-5)" }}>
            {error}
          </p>
        )}

        <Card>
          {flags === null ? null : openFlags.length === 0 ? (
            <p className="uikit-empty">Không có báo cáo nội dung nào đang chờ xử lý.</p>
          ) : (
            <div className="uikit-stack">
              {openFlags.map((flag) => {
                const isBusy = busyId === flag.id;
                const claimedByMe = flag.assignedReviewerUserId === me.userId;

                return (
                  <div
                    key={flag.id}
                    style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-4)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>
                          {MODERATION_TARGET_TYPE_LABELS[flag.targetType] ?? flag.targetType} ·{" "}
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {(flag.targetResourceId ?? flag.targetAnnotationId ?? flag.targetTechnologyProfileId ?? "").slice(0, 8)}
                          </span>
                        </p>
                        <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>
                          Lý do: {flag.reasonCode} · Báo cáo lúc {new Date(flag.createdAt).toLocaleString("vi-VN")}
                        </p>
                        <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>{flag.details}</p>
                      </div>
                      <StatusPill tone={toneOf(CONTENT_FLAG_STATUS_TONE, flag.status)}>
                        {CONTENT_FLAG_STATUS_LABELS[flag.status] ?? flag.status}
                      </StatusPill>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
                      {flag.status === "PENDING" && (
                        <PrimaryButton disabled={isBusy} onClick={() => onClaim(flag.id)}>
                          {isBusy ? "Đang xử lý…" : "Nhận xử lý"}
                        </PrimaryButton>
                      )}

                      {flag.status === "IN_REVIEW" && claimedByMe && decidingId !== flag.id && (
                        <PrimaryButton
                          disabled={isBusy}
                          onClick={() => {
                            setDecidingId(flag.id);
                            setDecisionAction("HIDE");
                            setRationale("");
                          }}
                        >
                          Ra quyết định
                        </PrimaryButton>
                      )}

                      {flag.status === "IN_REVIEW" && !claimedByMe && (
                        <span style={{ fontSize: 13, color: "var(--uikit-slate-400)" }}>Đang được kiểm định viên khác xử lý.</span>
                      )}
                    </div>

                    {flag.status === "IN_REVIEW" && claimedByMe && decidingId === flag.id && (
                      <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
                        <SelectField
                          label="Quyết định"
                          value={decisionAction}
                          onChange={(e) => setDecisionAction(e.target.value)}
                          options={DECISION_ACTIONS.map((action) => ({ value: action, label: MODERATION_ACTION_LABELS[action] }))}
                        />
                        <TextField
                          label="Diễn giải"
                          as="textarea"
                          required
                          value={rationale}
                          onChange={(e) => setRationale(e.target.value)}
                        />
                        <div style={{ display: "flex", gap: "var(--space-3)" }}>
                          <PrimaryButton disabled={isBusy || !rationale.trim()} onClick={() => onDecide(flag.id)}>
                            {isBusy ? "Đang xử lý…" : "Xác nhận quyết định"}
                          </PrimaryButton>
                          <GhostButton
                            disabled={isBusy}
                            onClick={() => {
                              setDecidingId(null);
                              setRationale("");
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
