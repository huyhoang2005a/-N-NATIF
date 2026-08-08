"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  CaseInitiationRequestResponse,
  CreateNeedStatementVersionRequest,
  CreateResearchProposalRequest,
  MeResponse,
  NeedStatementVersionResponse,
  OrganizationResponse,
  RecommendationItemResponse,
  RecommendationRunResponse,
  RejectResearchProposalRequest,
  ResearchNeedDetailResponse,
  ResearchNeedResponse,
  ResearchProposalResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { NEED_STATUS_LABELS, PLATFORM_ROLE_LABELS, PROPOSAL_STATUS_LABELS, VISIBILITY_LEVEL_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { NEED_STATUS_TONE, PROPOSAL_STATUS_TONE, toneOf } from "../../../lib/tone";
import {
  AbstractText,
  BackLink,
  Card,
  GhostButton,
  MatchScoreBadge,
  PrimaryButton,
  SectionHeader,
  SelectField,
  Shell,
  StatusPill,
  TextField,
} from "../../../components/ui";

export default function ResearchNeedDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const needId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [need, setNeed] = useState<ResearchNeedDetailResponse | null>(null);
  const [versions, setVersions] = useState<NeedStatementVersionResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showVersionForm, setShowVersionForm] = useState(false);
  const [versionForm, setVersionForm] = useState({
    problemStatement: "",
    technicalField: "",
    desiredOutputType: "",
    timeframeMonths: "",
    constraints: "",
    successCriteria: "",
  });
  const [versionStatus, setVersionStatus] = useState<"idle" | "loading" | "error">("idle");
  const [versionError, setVersionError] = useState<string | null>(null);

  const [proposals, setProposals] = useState<ResearchProposalResponse[] | null>(null);
  const [proposalActionBusy, setProposalActionBusy] = useState<string | null>(null);
  const [proposalActionError, setProposalActionError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    proposerOrganizationId: "",
    title: "",
    abstract: "",
    methodology: "",
    expectedOutcome: "",
    timelineMonths: "",
  });
  const [proposalStatus, setProposalStatus] = useState<"idle" | "loading">("idle");
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposalResult, setProposalResult] = useState<ResearchProposalResponse | null>(null);

  const [recommendationRun, setRecommendationRun] = useState<RecommendationRunResponse | null>(null);
  const [recommendationItems, setRecommendationItems] = useState<RecommendationItemResponse[] | null>(null);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  const [initiatingId, setInitiatingId] = useState<string | null>(null);
  const [initiateMessage, setInitiateMessage] = useState("");
  const [initiateBusy, setInitiateBusy] = useState<string | null>(null);
  const [initiateResults, setInitiateResults] = useState<Record<string, CaseInitiationRequestResponse>>({});

  const loadNeed = useCallback(() => {
    return Promise.all([
      authFetch<ResearchNeedDetailResponse>(`/research-needs/${needId}`),
      authFetch<NeedStatementVersionResponse[]>(`/research-needs/${needId}/versions`),
    ]).then(([n, v]) => {
      setNeed(n);
      setVersions(v);
      setVersionForm({
        problemStatement: n.currentVersion.problemStatement,
        technicalField: n.currentVersion.technicalField,
        desiredOutputType: n.currentVersion.desiredOutputType,
        timeframeMonths: n.currentVersion.timeframeMonths ? String(n.currentVersion.timeframeMonths) : "",
        constraints: n.currentVersion.constraints ?? "",
        successCriteria: n.currentVersion.successCriteria ?? "",
      });
    });
  }, [needId]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([authFetch<MeResponse>("/me"), authFetch<OrganizationResponse[]>("/organizations"), loadNeed()])
      .then(([meResponse, orgs]) => {
        setMe(meResponse);
        setOrganizations(orgs);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setLoadError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được nhu cầu nghiên cứu.");
      });
  }, [router, loadNeed]);

  function runAction(action: string, path: string) {
    setActionBusy(action);
    setActionError(null);
    authFetch<ResearchNeedResponse>(`/research-needs/${needId}/${path}`, { method: "POST" })
      .then(() => loadNeed())
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại.");
      })
      .finally(() => setActionBusy(null));
  }

  function onSubmitVersion(event: React.FormEvent) {
    event.preventDefault();
    setVersionStatus("loading");
    setVersionError(null);
    const payload: CreateNeedStatementVersionRequest = {
      problemStatement: versionForm.problemStatement,
      technicalField: versionForm.technicalField,
      desiredOutputType: versionForm.desiredOutputType,
      timeframeMonths: versionForm.timeframeMonths ? Number(versionForm.timeframeMonths) : undefined,
      constraints: versionForm.constraints || undefined,
      successCriteria: versionForm.successCriteria || undefined,
    };
    authFetch(`/research-needs/${needId}/versions`, { method: "POST", body: JSON.stringify(payload) })
      .then(() => {
        setShowVersionForm(false);
        return loadNeed();
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setVersionError(err instanceof ApiError ? describeErrorCode(err.code) : "Cập nhật nội dung thất bại.");
      })
      .finally(() => setVersionStatus("idle"));
  }

  useEffect(() => {
    if (!need || !organizations) return;
    const isOwner = organizations.some((o) => o.id === need.companyOrganizationId);
    if (!isOwner) return;
    authFetch<ResearchProposalResponse[]>(`/research-needs/${needId}/proposals`)
      .then(setProposals)
      .catch(() => setProposals([]));
  }, [need, organizations, needId]);

  useEffect(() => {
    if (!organizations) return;
    if (organizations.length > 0) {
      setProposalForm((f) => (f.proposerOrganizationId ? f : { ...f, proposerOrganizationId: organizations[0]!.id }));
    }
  }, [organizations]);

  function runProposalAction(proposalId: string, action: string, path: string, body?: unknown) {
    setProposalActionBusy(`${proposalId}:${action}`);
    setProposalActionError(null);
    authFetch<ResearchProposalResponse>(`/proposals/${proposalId}/${path}`, {
      method: "POST",
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
      .then((updated) => {
        setProposals((prev) => (prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev));
        setRejectingId(null);
        setRejectReason("");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setProposalActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại.");
      })
      .finally(() => setProposalActionBusy(null));
  }

  function onSubmitProposal(event: React.FormEvent) {
    event.preventDefault();
    setProposalStatus("loading");
    setProposalError(null);
    const payload: CreateResearchProposalRequest = {
      proposerOrganizationId: proposalForm.proposerOrganizationId,
      title: proposalForm.title,
      abstract: proposalForm.abstract,
      methodology: proposalForm.methodology,
      expectedOutcome: proposalForm.expectedOutcome,
      timelineMonths: Number(proposalForm.timelineMonths),
    };
    authFetch<ResearchProposalResponse>(`/research-needs/${needId}/proposals`, { method: "POST", body: JSON.stringify(payload) })
      .then((result) => {
        setProposalResult(result);
        setShowProposalForm(false);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setProposalError(err instanceof ApiError ? describeErrorCode(err.code) : "Gửi đề xuất thất bại.");
      })
      .finally(() => setProposalStatus("idle"));
  }

  function onRunRecommendation() {
    setRecommendationBusy(true);
    setRecommendationError(null);
    setRecommendationItems(null);
    authFetch<RecommendationRunResponse>(`/research-needs/${needId}/recommendation-runs`, { method: "POST" })
      .then((run) => setRecommendationRun(run))
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setRecommendationError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tạo được lượt gợi ý.");
        setRecommendationBusy(false);
      });
  }

  // No "latest run for this need" endpoint yet — recommendation results only live for the
  // current page session, not restored on reload. Acceptable first cut for Sprint 5.4.
  useEffect(() => {
    if (!recommendationRun) return;
    if (recommendationRun.status !== "QUEUED" && recommendationRun.status !== "RUNNING") {
      setRecommendationBusy(false);
      if (recommendationRun.status === "COMPLETED") {
        authFetch<RecommendationItemResponse[]>(`/recommendation-runs/${recommendationRun.id}/items`)
          .then(setRecommendationItems)
          .catch(() => setRecommendationItems([]));
      } else if (recommendationRun.status === "FAILED") {
        setRecommendationError(recommendationRun.errorMessage ?? "Lượt gợi ý thất bại.");
      }
      return;
    }
    const timer = setTimeout(() => {
      authFetch<RecommendationRunResponse>(`/recommendation-runs/${recommendationRun.id}`)
        .then(setRecommendationRun)
        .catch(() => setRecommendationBusy(false));
    }, 1500);
    return () => clearTimeout(timer);
  }, [recommendationRun]);

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
        setRecommendationError(err instanceof ApiError ? describeErrorCode(err.code) : "Gửi yêu cầu khởi tạo case thất bại.");
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

  if (!me || !organizations || !need || !versions) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");
  const isMember = organizations.some((o) => o.id === need.companyOrganizationId);

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack" style={{ maxWidth: 720 }}>
        <BackLink href="/needs">Quay lại danh sách nhu cầu</BackLink>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <h1 style={{ fontSize: 22 }}>{need.title}</h1>
          <StatusPill tone={toneOf(NEED_STATUS_TONE, need.status)}>{NEED_STATUS_LABELS[need.status] ?? need.status}</StatusPill>
        </div>
        <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
          {VISIBILITY_LEVEL_LABELS[need.visibility] ?? need.visibility}
        </p>

        {isMember && (
          <Card>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {need.status === "DRAFT" && (
                <PrimaryButton disabled={actionBusy === "publish"} onClick={() => runAction("publish", "publish")}>
                  {actionBusy === "publish" ? "Đang xuất bản…" : "Xuất bản"}
                </PrimaryButton>
              )}
              {need.status === "OPEN" && (
                <>
                  <GhostButton disabled={actionBusy === "pause"} onClick={() => runAction("pause", "pause")}>
                    {actionBusy === "pause" ? "Đang xử lý…" : "Tạm dừng"}
                  </GhostButton>
                  <GhostButton tone="red" disabled={actionBusy === "close"} onClick={() => runAction("close", "close")}>
                    {actionBusy === "close" ? "Đang xử lý…" : "Đóng nhu cầu"}
                  </GhostButton>
                </>
              )}
              {need.status === "PAUSED" && (
                <PrimaryButton disabled={actionBusy === "resume"} onClick={() => runAction("resume", "resume")}>
                  {actionBusy === "resume" ? "Đang xử lý…" : "Tiếp tục"}
                </PrimaryButton>
              )}
              {need.status === "DRAFT" || need.status === "OPEN" || need.status === "PAUSED" ? (
                <GhostButton onClick={() => setShowVersionForm((v) => !v)}>
                  {showVersionForm ? "Đóng" : "Cập nhật nội dung"}
                </GhostButton>
              ) : null}
            </div>
            {actionError && (
              <p className="uikit-alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
                {actionError}
              </p>
            )}
          </Card>
        )}

        <Card>
          <SectionHeader title="Mô tả nhu cầu" />
          {!showVersionForm ? (
            <div className="uikit-stack">
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{need.currentVersion.problemStatement}</p>
              <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
                Lĩnh vực: {need.currentVersion.technicalField} · Kết quả mong muốn: {need.currentVersion.desiredOutputType}
                {need.currentVersion.timeframeMonths ? ` · Thời hạn: ${need.currentVersion.timeframeMonths} tháng` : ""}
              </p>
              {need.currentVersion.constraints && <p style={{ fontSize: 13 }}>Ràng buộc: {need.currentVersion.constraints}</p>}
              {need.currentVersion.successCriteria && (
                <p style={{ fontSize: 13 }}>Tiêu chí thành công: {need.currentVersion.successCriteria}</p>
              )}
              <p style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>
                Phiên bản v{need.currentVersion.versionNo} · {versions.length} phiên bản trong lịch sử.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmitVersion} className="uikit-stack">
              <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
                Sửa nội dung sẽ tạo một phiên bản mới, không ghi đè nội dung cũ — đề xuất/gợi ý
                đã gửi trước đó vẫn giữ nguyên tham chiếu tới phiên bản tại thời điểm nộp.
              </p>
              <TextField
                label="Vấn đề cần giải quyết"
                as="textarea"
                required
                value={versionForm.problemStatement}
                onChange={(e) => setVersionForm({ ...versionForm, problemStatement: e.target.value })}
              />
              <TextField
                label="Lĩnh vực kỹ thuật"
                required
                value={versionForm.technicalField}
                onChange={(e) => setVersionForm({ ...versionForm, technicalField: e.target.value })}
              />
              <TextField
                label="Loại kết quả mong muốn"
                required
                value={versionForm.desiredOutputType}
                onChange={(e) => setVersionForm({ ...versionForm, desiredOutputType: e.target.value })}
              />
              <TextField
                label="Thời hạn mong muốn (tháng)"
                type="number"
                min={1}
                optional
                value={versionForm.timeframeMonths}
                onChange={(e) => setVersionForm({ ...versionForm, timeframeMonths: e.target.value })}
              />
              <TextField
                label="Ràng buộc"
                as="textarea"
                optional
                value={versionForm.constraints}
                onChange={(e) => setVersionForm({ ...versionForm, constraints: e.target.value })}
              />
              <TextField
                label="Tiêu chí thành công"
                as="textarea"
                optional
                value={versionForm.successCriteria}
                onChange={(e) => setVersionForm({ ...versionForm, successCriteria: e.target.value })}
              />
              {versionError && (
                <p className="uikit-alert-error" role="alert">
                  {versionError}
                </p>
              )}
              <PrimaryButton type="submit" disabled={versionStatus === "loading"}>
                {versionStatus === "loading" ? "Đang lưu…" : "Lưu phiên bản mới"}
              </PrimaryButton>
            </form>
          )}
        </Card>

        {isMember && proposals !== null && (
          <Card>
            <SectionHeader title="Đề xuất nhận được" />
            {proposalActionError && (
              <p className="uikit-alert-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>
                {proposalActionError}
              </p>
            )}
            {proposals.length === 0 ? (
              <p className="uikit-empty">Chưa có đề xuất nào cho nhu cầu này.</p>
            ) : (
              <div className="uikit-stack">
                {proposals.map((p) => {
                  const isBusy = (action: string) => proposalActionBusy === `${p.id}:${action}`;
                  return (
                    <div key={p.id} style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</span>
                        <StatusPill tone={toneOf(PROPOSAL_STATUS_TONE, p.status)}>
                          {PROPOSAL_STATUS_LABELS[p.status] ?? p.status}
                        </StatusPill>
                      </div>
                      <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-slate-500)", whiteSpace: "pre-wrap" }}>
                        {p.abstract}
                      </p>
                      <p style={{ marginTop: "var(--space-2)", fontSize: 12, color: "var(--uikit-slate-500)" }}>
                        Phương pháp: {p.methodology} · Kết quả kỳ vọng: {p.expectedOutcome} · Thời gian: {p.timelineMonths} tháng
                      </p>
                      {p.decisionReason && (
                        <p style={{ marginTop: "var(--space-2)", fontSize: 12, color: "var(--uikit-rose-700)" }}>
                          Lý do từ chối: {p.decisionReason}
                        </p>
                      )}

                      {p.status === "SUBMITTED" && (
                        <div style={{ marginTop: "var(--space-3)" }}>
                          <PrimaryButton disabled={isBusy("review")} onClick={() => runProposalAction(p.id, "review", "review")}>
                            {isBusy("review") ? "Đang xử lý…" : "Bắt đầu xem xét"}
                          </PrimaryButton>
                        </div>
                      )}

                      {p.status === "UNDER_REVIEW" && (
                        <div style={{ marginTop: "var(--space-3)" }}>
                          {rejectingId !== p.id ? (
                            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                              <PrimaryButton disabled={isBusy("accept")} onClick={() => runProposalAction(p.id, "accept", "accept")}>
                                {isBusy("accept") ? "Đang xử lý…" : "Chấp nhận → tạo Case"}
                              </PrimaryButton>
                              <GhostButton tone="red" onClick={() => setRejectingId(p.id)}>
                                Từ chối
                              </GhostButton>
                            </div>
                          ) : (
                            <div className="uikit-stack">
                              <TextField
                                label="Lý do từ chối"
                                as="textarea"
                                required
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                              />
                              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                <PrimaryButton
                                  disabled={isBusy("reject") || !rejectReason.trim()}
                                  onClick={() =>
                                    runProposalAction(p.id, "reject", "reject", { decisionReason: rejectReason } satisfies RejectResearchProposalRequest)
                                  }
                                >
                                  {isBusy("reject") ? "Đang gửi…" : "Xác nhận từ chối"}
                                </PrimaryButton>
                                <GhostButton onClick={() => { setRejectingId(null); setRejectReason(""); }}>Huỷ</GhostButton>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {isMember && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
              <SectionHeader title="Gợi ý AI" />
              <GhostButton disabled={recommendationBusy} onClick={onRunRecommendation}>
                {recommendationBusy ? "Đang chạy…" : recommendationRun ? "Chạy lại" : "Chạy gợi ý AI"}
              </GhostButton>
            </div>
            <p style={{ fontSize: 13, color: "var(--uikit-slate-500)", marginBottom: "var(--space-3)" }}>
              Tìm tài nguyên phù hợp với nhu cầu này qua tìm kiếm toàn văn (chưa dùng AI/LLM ở
              giai đoạn này).
            </p>
            {recommendationError && (
              <p className="uikit-alert-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>
                {recommendationError}
              </p>
            )}
            {recommendationBusy && <p className="uikit-empty">Đang xử lý — thường mất vài giây…</p>}
            {!recommendationBusy && recommendationItems !== null && (
              recommendationItems.length === 0 ? (
                <p className="uikit-empty">Không tìm thấy tài nguyên phù hợp trong lượt gợi ý này.</p>
              ) : (
                <div className="uikit-stack">
                  {recommendationItems.map((item) => {
                    const initiateResult = initiateResults[item.id];
                    return (
                      <div key={item.id} style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            #{item.rank} · {item.resourceTitle}
                          </span>
                          <MatchScoreBadge score={item.matchScore} />
                        </div>
                        <AbstractText text={item.summary} />
                        <p style={{ marginTop: "var(--space-2)", fontSize: 12, color: "var(--uikit-slate-500)", fontStyle: "italic" }}>
                          {item.rationale}
                        </p>

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
              )
            )}
          </Card>
        )}

        {!isMember && need.status === "OPEN" && need.visibility === "PUBLIC" && (
          <Card>
            <SectionHeader title="Gửi đề xuất" />
            {proposalResult ? (
              <StatusPill tone={toneOf(PROPOSAL_STATUS_TONE, proposalResult.status)}>
                Đã gửi đề xuất — {PROPOSAL_STATUS_LABELS[proposalResult.status] ?? proposalResult.status}
              </StatusPill>
            ) : !showProposalForm ? (
              <PrimaryButton onClick={() => setShowProposalForm(true)}>Gửi đề xuất cho nhu cầu này</PrimaryButton>
            ) : (
              <form onSubmit={onSubmitProposal} className="uikit-stack">
                {organizations.length > 1 && (
                  <SelectField
                    label="Tổ chức đề xuất"
                    value={proposalForm.proposerOrganizationId}
                    onChange={(e) => setProposalForm({ ...proposalForm, proposerOrganizationId: e.target.value })}
                    options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                  />
                )}
                <TextField label="Tiêu đề" required value={proposalForm.title} onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })} />
                <TextField
                  label="Tóm tắt đề xuất"
                  as="textarea"
                  required
                  value={proposalForm.abstract}
                  onChange={(e) => setProposalForm({ ...proposalForm, abstract: e.target.value })}
                />
                <TextField
                  label="Phương pháp thực hiện"
                  as="textarea"
                  required
                  value={proposalForm.methodology}
                  onChange={(e) => setProposalForm({ ...proposalForm, methodology: e.target.value })}
                />
                <TextField
                  label="Kết quả kỳ vọng"
                  as="textarea"
                  required
                  value={proposalForm.expectedOutcome}
                  onChange={(e) => setProposalForm({ ...proposalForm, expectedOutcome: e.target.value })}
                />
                <TextField
                  label="Thời gian thực hiện (tháng)"
                  type="number"
                  min={1}
                  required
                  value={proposalForm.timelineMonths}
                  onChange={(e) => setProposalForm({ ...proposalForm, timelineMonths: e.target.value })}
                />
                {proposalError && (
                  <p className="uikit-alert-error" role="alert">
                    {proposalError}
                  </p>
                )}
                <PrimaryButton type="submit" disabled={proposalStatus === "loading" || organizations.length === 0}>
                  {proposalStatus === "loading" ? "Đang gửi…" : "Gửi đề xuất"}
                </PrimaryButton>
              </form>
            )}
          </Card>
        )}
      </div>
    </Shell>
  );
}
