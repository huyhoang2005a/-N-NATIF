"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import type {
  CaseInitiationRequestResponse,
  MeResponse,
  OrganizationResponse,
  RecommendationItemResponse,
  RecommendationRunResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { AbstractText, Card, GhostButton, MatchScoreBadge, PrimaryButton, SectionHeader, Shell, TextField } from "../../components/ui";

export default function RecommendationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [items, setItems] = useState<RecommendationItemResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [run, setRun] = useState<RecommendationRunResponse | null>(null);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [dismissBusy, setDismissBusy] = useState<string | null>(null);

  const [initiatingId, setInitiatingId] = useState<string | null>(null);
  const [initiateMessage, setInitiateMessage] = useState("");
  const [initiateBusy, setInitiateBusy] = useState<string | null>(null);
  const [initiateResults, setInitiateResults] = useState<Record<string, CaseInitiationRequestResponse>>({});

  const primaryOrg = organizations?.[0];

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([authFetch<MeResponse>("/me"), authFetch<OrganizationResponse[]>("/organizations")])
      .then(([meResponse, orgs]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        const org = orgs[0];
        if (!org || org.type !== "ENTERPRISE" || org.status !== "ACTIVE") {
          setItems([]);
          return;
        }
        return authFetch<RecommendationItemResponse[]>(`/organizations/${org.id}/company-profile/feed`).then(setItems);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setLoadError("Không tải được gợi ý công nghệ.");
      });
  }, [router]);

  function onRefresh() {
    if (!primaryOrg) return;
    setRefreshBusy(true);
    setRefreshError(null);
    authFetch<RecommendationRunResponse>(`/organizations/${primaryOrg.id}/company-profile/feed/refresh`, { method: "POST" })
      .then(setRun)
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setRefreshError(err instanceof ApiError ? describeErrorCode(err.code) : "Không làm mới được gợi ý.");
        setRefreshBusy(false);
      });
  }

  useEffect(() => {
    if (!run || !primaryOrg) return;
    if (run.status !== "QUEUED" && run.status !== "RUNNING") {
      setRefreshBusy(false);
      if (run.status === "COMPLETED") {
        authFetch<RecommendationItemResponse[]>(`/organizations/${primaryOrg.id}/company-profile/feed`)
          .then(setItems)
          .catch(() => undefined);
      } else if (run.status === "FAILED") {
        setRefreshError(run.errorMessage ?? "Làm mới gợi ý thất bại.");
      }
      return;
    }
    const timer = setTimeout(() => {
      authFetch<RecommendationRunResponse>(`/recommendation-runs/${run.id}`).then(setRun).catch(() => setRefreshBusy(false));
    }, 1500);
    return () => clearTimeout(timer);
  }, [run, primaryOrg]);

  function onDismiss(itemId: string) {
    setDismissBusy(itemId);
    authFetch(`/recommendation-items/${itemId}/dismiss`, { method: "POST" })
      .then(() => setItems((prev) => (prev ? prev.filter((i) => i.id !== itemId) : prev)))
      .catch((err) => {
        if (err instanceof SessionExpiredError) router.push("/login");
      })
      .finally(() => setDismissBusy(null));
  }

  function onSubmitInitiate(itemId: string) {
    setInitiateBusy(itemId);
    authFetch<CaseInitiationRequestResponse>(`/recommendation-items/${itemId}/case-initiation-requests`, {
      method: "POST",
      body: JSON.stringify({ message: initiateMessage || undefined }),
    })
      .then((result) => {
        setInitiateResults((prev) => ({ ...prev, [itemId]: result }));
        setInitiatingId(null);
        setInitiateMessage("");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setRefreshError(err instanceof ApiError ? describeErrorCode(err.code) : "Gửi yêu cầu khởi tạo case thất bại.");
      })
      .finally(() => setInitiateBusy(null));
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

  if (!me || !organizations || !items) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");
  const canUseFeed = primaryOrg?.type === "ENTERPRISE" && primaryOrg.status === "ACTIVE";

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <h1 style={{ fontSize: 22, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Sparkles size={20} /> Gợi ý công nghệ
            </h1>
            <p style={{ fontSize: 13, color: "var(--uikit-slate-500)", marginTop: 4 }}>
              Duyệt khám phá tài nguyên phù hợp dựa trên hồ sơ công ty — không cần biết trước
              nhu cầu cụ thể.
            </p>
          </div>
          {canUseFeed && (
            <PrimaryButton disabled={refreshBusy} onClick={onRefresh}>
              {refreshBusy ? "Đang làm mới…" : "Làm mới gợi ý"}
            </PrimaryButton>
          )}
        </div>

        {!canUseFeed && (
          <p className="uikit-empty">
            Chỉ tổ chức doanh nghiệp (ENTERPRISE) đã được kích hoạt và có hồ sơ công ty mới
            dùng được gợi ý công nghệ.
          </p>
        )}

        {refreshError && (
          <p className="uikit-alert-error" role="alert">
            {refreshError}
          </p>
        )}

        {canUseFeed && (
          <Card>
            <SectionHeader title="Tài nguyên gợi ý" />
            {refreshBusy && items.length === 0 && <p className="uikit-empty">Đang xử lý — thường mất vài giây…</p>}
            {!refreshBusy && items.length === 0 && (
              <p className="uikit-empty">
                Chưa có gợi ý nào. Bấm &quot;Làm mới gợi ý&quot; để hệ thống tìm tài nguyên phù
                hợp với hồ sơ công ty của bạn.
              </p>
            )}
            {items.length > 0 && (
              <div className="uikit-stack">
                {items.map((item) => {
                  const initiateResult = initiateResults[item.id];
                  return (
                    <div key={item.id} style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{item.resourceTitle}</span>
                        <MatchScoreBadge score={item.matchScore} />
                      </div>
                      <AbstractText text={item.summary} />
                      <p style={{ marginTop: "var(--space-2)", fontSize: 12, color: "var(--uikit-slate-500)", fontStyle: "italic" }}>
                        {item.rationale}
                      </p>
                      <div style={{ marginTop: "var(--space-2)" }}>
                        <GhostButton disabled={dismissBusy === item.id} onClick={() => onDismiss(item.id)}>
                          {dismissBusy === item.id ? "Đang xử lý…" : "Không quan tâm"}
                        </GhostButton>
                      </div>

                      {initiateResult ? (
                        <p style={{ marginTop: "var(--space-3)", fontSize: 13, color: "var(--uikit-emerald-700)" }}>
                          Đã gửi yêu cầu khởi tạo case — đang chờ tác giả phản hồi.
                        </p>
                      ) : initiatingId !== item.id ? (
                        <PrimaryButton onClick={() => setInitiatingId(item.id)} style={{ marginTop: "var(--space-3)" }}>
                          Khởi tạo Case
                        </PrimaryButton>
                      ) : (
                        <div className="uikit-stack" style={{ marginTop: "var(--space-3)" }}>
                          <TextField
                            label="Lời nhắn tới tác giả (tuỳ chọn)"
                            as="textarea"
                            optional
                            value={initiateMessage}
                            onChange={(e) => setInitiateMessage(e.target.value)}
                          />
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <PrimaryButton disabled={initiateBusy === item.id} onClick={() => onSubmitInitiate(item.id)}>
                              {initiateBusy === item.id ? "Đang gửi…" : "Gửi yêu cầu"}
                            </PrimaryButton>
                            <GhostButton onClick={() => { setInitiatingId(null); setInitiateMessage(""); }}>Huỷ</GhostButton>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </Shell>
  );
}
