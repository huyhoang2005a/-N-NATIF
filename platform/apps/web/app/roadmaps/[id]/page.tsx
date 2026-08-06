"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  GapResponse,
  MilestoneDependencyResponse,
  RoadmapMilestoneResponse,
  RoadmapResponse,
  RoadmapReviewResponse,
  RoadmapTaskResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import {
  DEPENDENCY_TYPE_LABELS,
  GAP_SEVERITY_LABELS,
  MILESTONE_STATUS_LABELS,
  PRIORITY_LEVEL_LABELS,
  ROADMAP_REVIEW_DECISION_LABELS,
  ROADMAP_STATUS_LABELS,
  TASK_STATUS_LABELS,
  gapSeverityBadgeClass,
  milestoneStatusBadgeClass,
  roadmapStatusBadgeClass,
  taskStatusBadgeClass,
} from "../../../lib/labels";
import { getAccessToken } from "../../../lib/session";
import { FormField } from "../../_components/FormField";
import { SiteHeader } from "../../_components/SiteHeader";

const PRIORITY_LEVELS = Object.keys(PRIORITY_LEVEL_LABELS);
const DEPENDENCY_TYPES = Object.keys(DEPENDENCY_TYPE_LABELS);
const REVIEW_DECISIONS = Object.keys(ROADMAP_REVIEW_DECISION_LABELS);

export default function RoadmapDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roadmapId = params.id;

  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [milestones, setMilestones] = useState<RoadmapMilestoneResponse[] | null>(null);
  const [dependencies, setDependencies] = useState<MilestoneDependencyResponse[] | null>(null);
  const [reviews, setReviews] = useState<RoadmapReviewResponse[] | null>(null);
  const [caseGaps, setCaseGaps] = useState<GapResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const [milestoneTasks, setMilestoneTasks] = useState<Record<string, RoadmapTaskResponse[]>>({});
  const [milestoneGaps, setMilestoneGaps] = useState<Record<string, GapResponse[]>>({});

  async function load() {
    const r = await authFetch<RoadmapResponse>(`/roadmaps/${roadmapId}`);
    const [milestoneRows, dependencyRows, reviewRows, gapRows] = await Promise.all([
      authFetch<RoadmapMilestoneResponse[]>(`/roadmaps/${roadmapId}/milestones`),
      authFetch<MilestoneDependencyResponse[]>(`/roadmaps/${roadmapId}/dependencies`),
      authFetch<RoadmapReviewResponse[]>(`/roadmaps/${roadmapId}/reviews`),
      authFetch<GapResponse[]>(`/technology-cases/${r.technologyCaseId}/gaps`),
    ]);
    setRoadmap(r);
    setMilestones(milestoneRows);
    setDependencies(dependencyRows);
    setReviews(reviewRows);
    setCaseGaps(gapRows);
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
      setLoadError("Không tải được dữ liệu roadmap.");
    });
    // Intentionally depends only on roadmapId — `load` closes over state that would
    // otherwise cause a dependency-array footgun; router doesn't change across renders.
  }, [roadmapId]);

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

  async function toggleMilestone(milestoneId: string) {
    if (expandedMilestoneId === milestoneId) {
      setExpandedMilestoneId(null);
      return;
    }
    setExpandedMilestoneId(milestoneId);
    if (!milestoneTasks[milestoneId]) {
      const [tasks, gaps] = await Promise.all([
        authFetch<RoadmapTaskResponse[]>(`/milestones/${milestoneId}/tasks`),
        authFetch<GapResponse[]>(`/milestones/${milestoneId}/gaps`),
      ]);
      setMilestoneTasks((prev) => ({ ...prev, [milestoneId]: tasks }));
      setMilestoneGaps((prev) => ({ ...prev, [milestoneId]: gaps }));
    }
  }

  async function reloadMilestoneChildren(milestoneId: string) {
    const [tasks, gaps] = await Promise.all([
      authFetch<RoadmapTaskResponse[]>(`/milestones/${milestoneId}/tasks`),
      authFetch<GapResponse[]>(`/milestones/${milestoneId}/gaps`),
    ]);
    setMilestoneTasks((prev) => ({ ...prev, [milestoneId]: tasks }));
    setMilestoneGaps((prev) => ({ ...prev, [milestoneId]: gaps }));
  }

  // ---------- milestone ----------
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    description: "",
    priority: PRIORITY_LEVELS[0] ?? "LOW",
    startDate: "",
    dueDate: "",
    ownerUserId: "",
  });

  function onCreateMilestone() {
    return runAction("create-milestone", async () => {
      await authFetch(`/roadmaps/${roadmapId}/milestones`, {
        method: "POST",
        body: JSON.stringify({
          title: milestoneForm.title,
          description: milestoneForm.description || undefined,
          priority: milestoneForm.priority,
          startDate: milestoneForm.startDate || undefined,
          dueDate: milestoneForm.dueDate || undefined,
          ownerUserId: milestoneForm.ownerUserId || undefined,
        }),
      });
      setMilestoneForm({ title: "", description: "", priority: PRIORITY_LEVELS[0] ?? "LOW", startDate: "", dueDate: "", ownerUserId: "" });
      await load();
    });
  }

  // ---------- task ----------
  const [taskForms, setTaskForms] = useState<Record<string, { title: string; description: string; priority: string }>>({});

  function taskForm(milestoneId: string) {
    return taskForms[milestoneId] ?? { title: "", description: "", priority: PRIORITY_LEVELS[0] ?? "LOW" };
  }

  function onCreateTask(milestoneId: string) {
    const form = taskForm(milestoneId);
    return runAction(`create-task-${milestoneId}`, async () => {
      await authFetch(`/milestones/${milestoneId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          priority: form.priority,
        }),
      });
      setTaskForms({ ...taskForms, [milestoneId]: { title: "", description: "", priority: PRIORITY_LEVELS[0] ?? "LOW" } });
      await reloadMilestoneChildren(milestoneId);
    });
  }

  // ---------- link gap ----------
  const [linkGapId, setLinkGapId] = useState<Record<string, string>>({});

  function onLinkGap(milestoneId: string) {
    const gapId = linkGapId[milestoneId];
    if (!gapId) return Promise.resolve();
    return runAction(`link-gap-${milestoneId}`, async () => {
      await authFetch(`/milestones/${milestoneId}/gaps`, {
        method: "POST",
        body: JSON.stringify({ gapRecordId: gapId }),
      });
      setLinkGapId({ ...linkGapId, [milestoneId]: "" });
      await reloadMilestoneChildren(milestoneId);
    });
  }

  // ---------- dependency ----------
  const [depForm, setDepForm] = useState({ predecessorMilestoneId: "", successorMilestoneId: "", dependencyType: DEPENDENCY_TYPES[0] ?? "FINISH_TO_START", lagDays: "0" });

  function onCreateDependency() {
    return runAction("create-dependency", async () => {
      await authFetch(`/roadmaps/${roadmapId}/dependencies`, {
        method: "POST",
        body: JSON.stringify({
          predecessorMilestoneId: depForm.predecessorMilestoneId,
          successorMilestoneId: depForm.successorMilestoneId,
          dependencyType: depForm.dependencyType,
          lagDays: Number(depForm.lagDays) || 0,
        }),
      });
      await load();
    });
  }

  // ---------- submit / review ----------
  function onSubmitRoadmap() {
    return runAction("submit", async () => {
      await authFetch(`/roadmaps/${roadmapId}/submit`, { method: "POST" });
      await load();
    });
  }

  const [reviewDecision, setReviewDecision] = useState(REVIEW_DECISIONS[0] ?? "APPROVED");
  const [reviewComment, setReviewComment] = useState("");

  function onReview() {
    return runAction("review", async () => {
      await authFetch(`/roadmaps/${roadmapId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ decision: reviewDecision, comment: reviewComment || undefined }),
      });
      setReviewComment("");
      await load();
    });
  }

  function milestoneTitle(id: string): string {
    return milestones?.find((m) => m.id === id)?.title ?? id.slice(0, 8);
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

  if (!roadmap || !milestones || !dependencies || !reviews || !caseGaps) {
    return (
      <div className="shell">
        <SiteHeader />
      </div>
    );
  }

  return (
    <div className="shell">
      <SiteHeader />
      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)", maxWidth: 860 }}>
        <span className="eyebrow">Phase 4 · Roadmap</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <h1 style={{ fontSize: 30 }}>
            {roadmap.title} · v{roadmap.versionNo}
          </h1>
          <span className={roadmapStatusBadgeClass(roadmap.status)}>{ROADMAP_STATUS_LABELS[roadmap.status] ?? roadmap.status}</span>
        </div>
        {roadmap.objective && <p style={{ marginTop: "var(--space-3)", fontSize: 14, color: "var(--ink-700)" }}>{roadmap.objective}</p>}

        {actionError && (
          <p className="alert alert-error" role="alert" style={{ marginTop: "var(--space-5)" }}>
            {actionError}
          </p>
        )}

        {roadmap.status === "DRAFT" && (
          <div className="card" style={{ marginTop: "var(--space-6)" }}>
            <span className="eyebrow">Nộp roadmap</span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyKey === "submit"}
              onClick={onSubmitRoadmap}
              style={{ marginTop: "var(--space-4)" }}
            >
              {busyKey === "submit" ? "Đang nộp…" : "Nộp roadmap để duyệt"}
            </button>
          </div>
        )}

        {roadmap.status === "IN_REVIEW" && (
          <div className="card">
            <span className="eyebrow">Review (chỉ CASE_REVIEWER)</span>
            <div className="field-row" style={{ marginTop: "var(--space-4)" }}>
              <FormField label="Quyết định">
                <select value={reviewDecision} onChange={(e) => setReviewDecision(e.target.value)}>
                  {REVIEW_DECISIONS.map((d) => (
                    <option key={d} value={d}>
                      {ROADMAP_REVIEW_DECISION_LABELS[d]}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Ghi chú" optional>
              <textarea rows={2} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
            </FormField>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyKey === "review"}
              onClick={onReview}
              style={{ marginTop: "var(--space-4)" }}
            >
              {busyKey === "review" ? "Đang gửi…" : "Gửi quyết định"}
            </button>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="card">
            <span className="eyebrow">Lịch sử review ({reviews.length})</span>
            <div className="row-list" style={{ marginTop: "var(--space-4)" }}>
              {reviews.map((rv) => (
                <div key={rv.id} className="row-card">
                  <div>
                    <strong>{ROADMAP_REVIEW_DECISION_LABELS[rv.decision] ?? rv.decision}</strong>
                    {rv.comment && <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--ink-400)" }}>{rv.comment}</p>}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-400)" }}>{new Date(rv.createdAt).toLocaleString("vi-VN")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- milestones ---------- */}
        <div className="card">
          <span className="eyebrow">Milestone ({milestones.length})</span>
          {milestones.length === 0 ? (
            <p className="empty-state" style={{ marginTop: "var(--space-4)" }}>
              Chưa có milestone nào.
            </p>
          ) : (
            <div className="row-list" style={{ marginTop: "var(--space-4)" }}>
              {milestones.map((m) => {
                const expanded = expandedMilestoneId === m.id;
                return (
                  <div key={m.id} className="row-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", cursor: "pointer" }}
                      onClick={() => toggleMilestone(m.id)}
                    >
                      <div>
                        <strong>{m.title}</strong>
                        <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--ink-400)" }}>
                          {PRIORITY_LEVEL_LABELS[m.priority] ?? m.priority}
                        </p>
                      </div>
                      <span className={milestoneStatusBadgeClass(m.status)}>{MILESTONE_STATUS_LABELS[m.status] ?? m.status}</span>
                    </div>

                    {expanded && (
                      <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--ink-200)" }}>
                        <span className="eyebrow">Task ({milestoneTasks[m.id]?.length ?? 0})</span>
                        <div className="row-list" style={{ marginTop: "var(--space-3)" }}>
                          {(milestoneTasks[m.id] ?? []).map((t) => (
                            <div key={t.id} className="row-card">
                              <strong>{t.title}</strong>
                              <span className={taskStatusBadgeClass(t.status)}>{TASK_STATUS_LABELS[t.status] ?? t.status}</span>
                            </div>
                          ))}
                        </div>
                        <div className="field-row" style={{ marginTop: "var(--space-3)" }}>
                          <FormField label="Task mới">
                            <input
                              value={taskForm(m.id).title}
                              onChange={(e) => setTaskForms({ ...taskForms, [m.id]: { ...taskForm(m.id), title: e.target.value } })}
                            />
                          </FormField>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busyKey === `create-task-${m.id}` || !taskForm(m.id).title}
                          onClick={() => onCreateTask(m.id)}
                          style={{ marginTop: "var(--space-3)" }}
                        >
                          {busyKey === `create-task-${m.id}` ? "Đang thêm…" : "+ Thêm task"}
                        </button>

                        <div style={{ marginTop: "var(--space-5)" }}>
                          <span className="eyebrow">Gap liên kết ({milestoneGaps[m.id]?.length ?? 0})</span>
                          <div className="row-list" style={{ marginTop: "var(--space-3)" }}>
                            {(milestoneGaps[m.id] ?? []).map((g) => (
                              <div key={g.id} className="row-card">
                                <strong>{g.title}</strong>
                                <span className={gapSeverityBadgeClass(g.severity)}>{GAP_SEVERITY_LABELS[g.severity] ?? g.severity}</span>
                              </div>
                            ))}
                          </div>
                          <div className="field-row" style={{ marginTop: "var(--space-3)" }}>
                            <FormField label="Liên kết gap của case">
                              <select
                                value={linkGapId[m.id] ?? ""}
                                onChange={(e) => setLinkGapId({ ...linkGapId, [m.id]: e.target.value })}
                              >
                                <option value="">— Chọn gap —</option>
                                {caseGaps.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.title}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busyKey === `link-gap-${m.id}` || !linkGapId[m.id]}
                            onClick={() => onLinkGap(m.id)}
                            style={{ marginTop: "var(--space-3)" }}
                          >
                            {busyKey === `link-gap-${m.id}` ? "Đang liên kết…" : "+ Liên kết gap"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="form-stack" style={{ marginTop: "var(--space-5)" }}>
            <FormField label="Tiêu đề milestone mới">
              <input value={milestoneForm.title} onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })} />
            </FormField>
            <div className="field-row">
              <FormField label="Độ ưu tiên">
                <select value={milestoneForm.priority} onChange={(e) => setMilestoneForm({ ...milestoneForm, priority: e.target.value })}>
                  {PRIORITY_LEVELS.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LEVEL_LABELS[p]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Ngày bắt đầu" optional>
                <input type="date" value={milestoneForm.startDate} onChange={(e) => setMilestoneForm({ ...milestoneForm, startDate: e.target.value })} />
              </FormField>
              <FormField label="Hạn hoàn thành" optional>
                <input type="date" value={milestoneForm.dueDate} onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })} />
              </FormField>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busyKey === "create-milestone" || !milestoneForm.title}
            onClick={onCreateMilestone}
            style={{ marginTop: "var(--space-4)" }}
          >
            {busyKey === "create-milestone" ? "Đang tạo…" : "+ Thêm milestone"}
          </button>
        </div>

        {/* ---------- dependencies ---------- */}
        <div className="card">
          <span className="eyebrow">Phụ thuộc milestone ({dependencies.length})</span>
          {dependencies.length === 0 ? (
            <p className="empty-state" style={{ marginTop: "var(--space-4)" }}>
              Chưa có phụ thuộc nào.
            </p>
          ) : (
            <div className="row-list" style={{ marginTop: "var(--space-4)" }}>
              {dependencies.map((d) => (
                <div key={d.id} className="row-card">
                  <span>
                    {milestoneTitle(d.predecessorMilestoneId)} → {milestoneTitle(d.successorMilestoneId)}
                  </span>
                  <span className="badge">{DEPENDENCY_TYPE_LABELS[d.dependencyType] ?? d.dependencyType}</span>
                </div>
              ))}
            </div>
          )}
          <div className="field-row" style={{ marginTop: "var(--space-5)" }}>
            <FormField label="Trước">
              <select value={depForm.predecessorMilestoneId} onChange={(e) => setDepForm({ ...depForm, predecessorMilestoneId: e.target.value })}>
                <option value="">— Chọn milestone —</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Sau">
              <select value={depForm.successorMilestoneId} onChange={(e) => setDepForm({ ...depForm, successorMilestoneId: e.target.value })}>
                <option value="">— Chọn milestone —</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Loại phụ thuộc">
              <select value={depForm.dependencyType} onChange={(e) => setDepForm({ ...depForm, dependencyType: e.target.value })}>
                {DEPENDENCY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DEPENDENCY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busyKey === "create-dependency" || !depForm.predecessorMilestoneId || !depForm.successorMilestoneId}
            onClick={onCreateDependency}
            style={{ marginTop: "var(--space-4)" }}
          >
            {busyKey === "create-dependency" ? "Đang thêm…" : "+ Thêm phụ thuộc"}
          </button>
        </div>
      </div>
    </div>
  );
}
