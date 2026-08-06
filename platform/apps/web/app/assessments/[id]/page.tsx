"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  AssessmentCriterionResponse,
  AssessmentFrameworkResponse,
  AssessmentScoreResponse,
  ReadinessAssessmentResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { ASSESSMENT_STATUS_LABELS, assessmentStatusBadgeClass } from "../../../lib/labels";
import { getAccessToken } from "../../../lib/session";
import { FormField } from "../../_components/FormField";
import { SiteHeader } from "../../_components/SiteHeader";

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
    const a = await authFetch<ReadinessAssessmentResponse>(`/assessments/${assessmentId}`);
    const [fw, criteriaRows, scoreRows] = await Promise.all([
      authFetch<AssessmentFrameworkResponse>(`/assessment-frameworks/${a.frameworkId}`),
      authFetch<AssessmentCriterionResponse[]>(`/assessment-frameworks/${a.frameworkId}/criteria`),
      authFetch<AssessmentScoreResponse[]>(`/assessments/${assessmentId}/scores`),
    ]);
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

  if (loadError) {
    return (
      <div className="shell">
        <SiteHeader />
        <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)" }}>
          <p className="alert alert-error" role="alert">
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  if (!assessment || !framework || !criteria || !scores) {
    return (
      <div className="shell">
        <SiteHeader />
      </div>
    );
  }

  return (
    <div className="shell">
      <SiteHeader />
      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)", maxWidth: 760 }}>
        <span className="eyebrow">Phase 4 · Assessment</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <div>
            <h1 style={{ fontSize: 30 }}>{framework.name}</h1>
            <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--ink-400)" }}>
              Phiên bản khung đánh giá {framework.versionNo}
            </p>
          </div>
          <span className={assessmentStatusBadgeClass(assessment.status)}>
            {ASSESSMENT_STATUS_LABELS[assessment.status] ?? assessment.status}
          </span>
        </div>

        {assessment.compositeScore !== null && (
          <div className="callout" style={{ marginTop: "var(--space-5)" }}>
            <div>
              <strong>Điểm tổng hợp (composite score)</strong>
              <p style={{ marginTop: "var(--space-1)", fontSize: 24, fontFamily: "var(--font-mono)" }}>
                {assessment.compositeScore.toFixed(2)} / 100
              </p>
            </div>
          </div>
        )}

        {actionError && (
          <p className="alert alert-error" role="alert" style={{ marginTop: "var(--space-5)" }}>
            {actionError}
          </p>
        )}

        <div className="card" style={{ marginTop: "var(--space-6)" }}>
          <span className="eyebrow">Tiêu chí đánh giá ({criteria.length})</span>
          <div className="row-list" style={{ marginTop: "var(--space-4)" }}>
            {criteria.map((criterion) => {
              const form = scoreForms[criterion.id] ?? emptyScoreForm();
              const busy = busyKey === `score-${criterion.id}`;
              const alreadyScored = scores.some((s) => s.criterionId === criterion.id);
              return (
                <div key={criterion.id} className="row-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
                    <div>
                      <strong>{criterion.title}</strong>
                      <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--ink-400)" }}>
                        {criterion.description}
                      </p>
                      <p style={{ marginTop: "var(--space-1)", fontSize: 12, color: "var(--ink-400)" }}>
                        Khoảng điểm [{criterion.minScore}, {criterion.maxScore}] · trọng số {criterion.weight}
                        {criterion.requiresEvidence ? " · cần evidence" : ""}
                        {criterion.requiresCitation ? " · cần citation" : ""}
                      </p>
                    </div>
                    {alreadyScored && <span className="badge badge-active">Đã nhập</span>}
                  </div>

                  <div className="form-stack" style={{ marginTop: "var(--space-4)" }}>
                    <div className="field-row">
                      <FormField label="Điểm">
                        <input
                          type="number"
                          step="0.1"
                          min={criterion.minScore}
                          max={criterion.maxScore}
                          value={form.score}
                          onChange={(e) =>
                            setScoreForms({ ...scoreForms, [criterion.id]: { ...form, score: e.target.value } })
                          }
                        />
                      </FormField>
                    </div>
                    <FormField label="Lý giải (rationale)">
                      <textarea
                        rows={2}
                        value={form.rationale}
                        onChange={(e) =>
                          setScoreForms({ ...scoreForms, [criterion.id]: { ...form, rationale: e.target.value } })
                        }
                      />
                    </FormField>
                    <div className="field-row">
                      <FormField label="Evidence ID" optional hint="UUID, phân tách bằng dấu phẩy">
                        <input
                          value={form.evidenceIds}
                          onChange={(e) =>
                            setScoreForms({ ...scoreForms, [criterion.id]: { ...form, evidenceIds: e.target.value } })
                          }
                        />
                      </FormField>
                      <FormField label="Citation ID" optional hint="UUID, phân tách bằng dấu phẩy">
                        <input
                          value={form.citationIds}
                          onChange={(e) =>
                            setScoreForms({ ...scoreForms, [criterion.id]: { ...form, citationIds: e.target.value } })
                          }
                        />
                      </FormField>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy || !form.score || !form.rationale || assessment.status !== "DRAFT"}
                    onClick={() => onSaveScore(criterion.id)}
                    style={{ marginTop: "var(--space-3)", alignSelf: "flex-start" }}
                  >
                    {busy ? "Đang lưu…" : "Lưu điểm"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {assessment.status === "DRAFT" && (
          <div className="card">
            <span className="eyebrow">Nộp đánh giá</span>
            <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--ink-700)" }}>
              Composite score sẽ được server tính lại từ toàn bộ điểm đã nhập — không thể tự nhập điểm tổng.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyKey === "submit"}
              onClick={onSubmitAssessment}
              style={{ marginTop: "var(--space-4)" }}
            >
              {busyKey === "submit" ? "Đang nộp…" : "Nộp assessment"}
            </button>
          </div>
        )}

        {assessment.status === "SUBMITTED" && (
          <div className="card">
            <span className="eyebrow">Quyết định (chỉ CASE_REVIEWER)</span>
            <div className="row-card__actions" style={{ marginTop: "var(--space-4)" }}>
              <button type="button" className="btn btn-primary" disabled={busyKey === "approve"} onClick={onApprove}>
                {busyKey === "approve" ? "Đang duyệt…" : "Duyệt"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyKey === "reject"}
                onClick={() => setShowReject(true)}
              >
                Từ chối
              </button>
            </div>
            {showReject && (
              <div className="form-stack" style={{ marginTop: "var(--space-4)" }}>
                <FormField label="Lý do từ chối">
                  <textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                </FormField>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyKey === "reject" || !rejectReason.trim()}
                  onClick={onReject}
                >
                  {busyKey === "reject" ? "Đang từ chối…" : "Xác nhận từ chối"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
