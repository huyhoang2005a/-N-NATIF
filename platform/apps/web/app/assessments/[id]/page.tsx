"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Save, Send, X } from "lucide-react";
import type {
  AssessmentCriterionResponse,
  AssessmentFrameworkResponse,
  AssessmentScoreResponse,
  MeResponse,
  OrganizationResponse,
  ReadinessAssessmentResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { ASSESSMENT_STATUS_LABELS, PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { toneOf, ASSESSMENT_STATUS_TONE } from "../../../lib/tone";
import { Card, GhostButton, PrimaryButton, Shell, StatusPill, TextField } from "../../../components/ui";

interface ScoreFormState {
  score: string;
  rationale: string;
  evidenceIds: string;
  citationIds: string;
}

function emptyScoreForm(): ScoreFormState {
  return { score: "", rationale: "", evidenceIds: "", citationIds: "" };
}

export default function AssessmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const assessmentId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [assessment, setAssessment] = useState<ReadinessAssessmentResponse | null>(null);
  const [framework, setFramework] = useState<AssessmentFrameworkResponse | null>(null);
  const [criteria, setCriteria] = useState<AssessmentCriterionResponse[] | null>(null);
  const [scores, setScores] = useState<AssessmentScoreResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [scoreForms, setScoreForms] = useState<Record<string, ScoreFormState>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function load() {
    const [meResponse, myOrgs, a] = await Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ReadinessAssessmentResponse>(`/assessments/${assessmentId}`),
    ]);
    const [fw, criteriaRows, scoreRows] = await Promise.all([
      authFetch<AssessmentFrameworkResponse>(`/assessment-frameworks/${a.frameworkId}`),
      authFetch<AssessmentCriterionResponse[]>(`/assessment-frameworks/${a.frameworkId}/criteria`),
      authFetch<AssessmentScoreResponse[]>(`/assessments/${assessmentId}/scores`),
    ]);
    setMe(meResponse);
    setOrganizations(myOrgs);
    setAssessment(a);
    setFramework(fw);
    setCriteria(criteriaRows);
    setScores(scoreRows);

    setScoreForms((prev) => {
      const next: Record<string, ScoreFormState> = { ...prev };
      for (const criterion of criteriaRows) {
        if (next[criterion.id]) continue;
        const existing = scoreRows.find((s) => s.criterionId === criterion.id);
        next[criterion.id] = existing
          ? {
              score: String(existing.score),
              rationale: existing.rationale,
              evidenceIds: existing.evidenceIds.join(", "),
              citationIds: existing.citationIds.join(", "),
            }
          : emptyScoreForm();
      }
      return next;
    });
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    load().catch((err) => {
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setLoadError("Không tải được dữ liệu đánh giá.");
    });
    // Intentionally depends only on assessmentId — `load` closes over state that would
    // otherwise cause a dependency-array footgun; router doesn't change across renders.
  }, [assessmentId]);

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại, vui lòng thử lại.");
    } finally {
      setBusyKey(null);
    }
  }

  function onSaveScore(criterionId: string) {
    const form = scoreForms[criterionId];
    if (!form) return Promise.resolve();
    return runAction(`score-${criterionId}`, async () => {
      await authFetch(`/assessments/${assessmentId}/scores/${criterionId}`, {
        method: "PUT",
        body: JSON.stringify({
          score: Number(form.score),
          rationale: form.rationale,
          evidenceIds: form.evidenceIds
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          citationIds: form.citationIds
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        }),
      });
      await load();
    });
  }

  function onSubmitAssessment() {
    return runAction("submit", async () => {
      await authFetch(`/assessments/${assessmentId}/submit`, { method: "POST" });
      await load();
    });
  }

  function onApprove() {
    return runAction("approve", async () => {
      await authFetch(`/assessments/${assessmentId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: "APPROVE" }),
      });
      await load();
    });
  }

  function onReject() {
    if (!rejectReason.trim()) return Promise.resolve();
    return runAction("reject", async () => {
      await authFetch(`/assessments/${assessmentId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: "REJECT", reason: rejectReason.trim() }),
      });
      setShowReject(false);
      setRejectReason("");
      await load();
    });
  }

  if (!me || !organizations) {
    if (loadError) {
      return (
        <div className="uikit-main" style={{ maxWidth: 760, margin: "0 auto" }}>
          <p className="uikit-alert-error" role="alert">
            {loadError}
          </p>
        </div>
      );
    }
    return null;
  }

  const roleLabel = PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole;
  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  if (loadError) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        <p className="uikit-alert-error" role="alert">
          {loadError}
        </p>
      </Shell>
    );
  }

  if (!assessment || !framework || !criteria || !scores) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        {null}
      </Shell>
    );
  }

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
      <div className="uikit-stack" style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <div>
            <h1 style={{ fontSize: 22 }}>{framework.name}</h1>
            <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--uikit-slate-500)" }}>
              Phiên bản khung đánh giá {framework.versionNo}
            </p>
          </div>
          <StatusPill tone={toneOf(ASSESSMENT_STATUS_TONE, assessment.status)}>
            {ASSESSMENT_STATUS_LABELS[assessment.status] ?? assessment.status}
          </StatusPill>
        </div>

        {assessment.compositeScore !== null && (
          <Card style={{ background: "var(--uikit-indigo-50)", border: "none" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-indigo-700)" }}>Điểm tổng hợp</p>
            <p style={{ marginTop: 4, fontSize: 26, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {assessment.compositeScore.toFixed(2)} / 100
            </p>
          </Card>
        )}

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-4)" }}>
            Tiêu chí đánh giá ({criteria.length})
          </h2>
          <div className="uikit-stack">
            {criteria.map((criterion) => {
              const form = scoreForms[criterion.id] ?? emptyScoreForm();
              const busy = busyKey === `score-${criterion.id}`;
              const alreadyScored = scores.some((s) => s.criterionId === criterion.id);
              return (
                <div
                  key={criterion.id}
                  style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-4)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{criterion.title}</p>
                      <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>{criterion.description}</p>
                      <p style={{ marginTop: 4, fontSize: 12, color: "var(--uikit-slate-400)" }}>
                        Khoảng điểm [{criterion.minScore}, {criterion.maxScore}] · trọng số {criterion.weight}
                        {criterion.requiresEvidence ? " · cần evidence" : ""}
                        {criterion.requiresCitation ? " · cần citation" : ""}
                      </p>
                    </div>
                    {alreadyScored && <StatusPill tone="green">Đã nhập</StatusPill>}
                  </div>

                  <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
                    <TextField
                      label="Điểm"
                      type="number"
                      step="0.1"
                      min={criterion.minScore}
                      max={criterion.maxScore}
                      value={form.score}
                      onChange={(e) => setScoreForms({ ...scoreForms, [criterion.id]: { ...form, score: e.target.value } })}
                    />
                    <TextField
                      label="Lý giải (rationale)"
                      as="textarea"
                      value={form.rationale}
                      onChange={(e) => setScoreForms({ ...scoreForms, [criterion.id]: { ...form, rationale: e.target.value } })}
                    />
                    <TextField
                      label="Evidence ID"
                      optional
                      hint="UUID, phân tách bằng dấu phẩy"
                      value={form.evidenceIds}
                      onChange={(e) => setScoreForms({ ...scoreForms, [criterion.id]: { ...form, evidenceIds: e.target.value } })}
                    />
                    <TextField
                      label="Citation ID"
                      optional
                      hint="UUID, phân tách bằng dấu phẩy"
                      value={form.citationIds}
                      onChange={(e) => setScoreForms({ ...scoreForms, [criterion.id]: { ...form, citationIds: e.target.value } })}
                    />
                  </div>

                  <GhostButton
                    icon={Save}
                    disabled={busy || !form.score || !form.rationale || assessment.status !== "DRAFT"}
                    onClick={() => onSaveScore(criterion.id)}
                    className="uikit-mt-4"
                  >
                    {busy ? "Đang lưu…" : "Lưu điểm"}
                  </GhostButton>
                </div>
              );
            })}
          </div>
        </Card>

        {assessment.status === "DRAFT" && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Nộp đánh giá</h2>
            <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-slate-500)" }}>
              Composite score sẽ được server tính lại từ toàn bộ điểm đã nhập — không thể tự nhập điểm tổng.
            </p>
            <PrimaryButton icon={Send} disabled={busyKey === "submit"} onClick={onSubmitAssessment} style={{ marginTop: "var(--space-4)" }}>
              {busyKey === "submit" ? "Đang nộp…" : "Nộp đánh giá"}
            </PrimaryButton>
          </Card>
        )}

        {assessment.status === "SUBMITTED" && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Quyết định (chỉ kiểm định viên của case)</h2>
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <PrimaryButton icon={Check} disabled={busyKey === "approve"} onClick={onApprove}>
                {busyKey === "approve" ? "Đang duyệt…" : "Duyệt"}
              </PrimaryButton>
              <GhostButton tone="red" icon={X} disabled={busyKey === "reject"} onClick={() => setShowReject(true)}>
                Từ chối
              </GhostButton>
            </div>
            {showReject && (
              <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
                <TextField label="Lý do từ chối" as="textarea" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <PrimaryButton disabled={busyKey === "reject" || !rejectReason.trim()} onClick={onReject}>
                  {busyKey === "reject" ? "Đang từ chối…" : "Xác nhận từ chối"}
                </PrimaryButton>
              </div>
            )}
          </Card>
        )}
      </div>
    </Shell>
  );
}
