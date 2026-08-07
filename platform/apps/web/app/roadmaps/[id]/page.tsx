"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Link2, Plus, Send } from "lucide-react";
import type {
  GapResponse,
  MeResponse,
  MilestoneDependencyResponse,
  OrganizationResponse,
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
  PLATFORM_ROLE_LABELS,
  PRIORITY_LEVEL_LABELS,
  ROADMAP_REVIEW_DECISION_LABELS,
  ROADMAP_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import {
  toneOf,
  GAP_SEVERITY_TONE,
  MILESTONE_STATUS_TONE,
  ROADMAP_STATUS_TONE,
  TASK_STATUS_TONE,
} from "../../../lib/tone";
import { Card, GhostButton, PrimaryButton, SelectField, Shell, StatusPill, TextField } from "../../../components/ui";

const PRIORITY_LEVELS = Object.keys(PRIORITY_LEVEL_LABELS);
const DEPENDENCY_TYPES = Object.keys(DEPENDENCY_TYPE_LABELS);
const REVIEW_DECISIONS = Object.keys(ROADMAP_REVIEW_DECISION_LABELS);

export default function RoadmapDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roadmapId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
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
    const [meResponse, myOrgs, r] = await Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<RoadmapResponse>(`/roadmaps/${roadmapId}`),
    ]);
    const [milestoneRows, dependencyRows, reviewRows, gapRows] = await Promise.all([
      authFetch<RoadmapMilestoneResponse[]>(`/roadmaps/${roadmapId}/milestones`),
      authFetch<MilestoneDependencyResponse[]>(`/roadmaps/${roadmapId}/dependencies`),
      authFetch<RoadmapReviewResponse[]>(`/roadmaps/${roadmapId}/reviews`),
      authFetch<GapResponse[]>(`/technology-cases/${r.technologyCaseId}/gaps`),
    ]);
    setMe(meResponse);
    setOrganizations(myOrgs);
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

  if (!me || !organizations) {
    if (loadError) {
      return (
        <div className="uikit-main" style={{ maxWidth: 860, margin: "0 auto" }}>
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

  if (!roadmap || !milestones || !dependencies || !reviews || !caseGaps) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        {null}
      </Shell>
    );
  }

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
      <div className="uikit-stack" style={{ maxWidth: 800 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <h1 style={{ fontSize: 22 }}>
            {roadmap.title} · v{roadmap.versionNo}
          </h1>
          <StatusPill tone={toneOf(ROADMAP_STATUS_TONE, roadmap.status)}>
            {ROADMAP_STATUS_LABELS[roadmap.status] ?? roadmap.status}
          </StatusPill>
        </div>
        {roadmap.objective && <p style={{ fontSize: 14, color: "var(--uikit-slate-700)" }}>{roadmap.objective}</p>}

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        {roadmap.status === "DRAFT" && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-4)" }}>Nộp roadmap</h2>
            <PrimaryButton icon={Send} disabled={busyKey === "submit"} onClick={onSubmitRoadmap}>
              {busyKey === "submit" ? "Đang nộp…" : "Nộp roadmap để duyệt"}
            </PrimaryButton>
          </Card>
        )}

        {roadmap.status === "IN_REVIEW" && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-4)" }}>Review (chỉ kiểm định viên của case)</h2>
            <div className="uikit-stack">
              <SelectField
                label="Quyết định"
                value={reviewDecision}
                onChange={(e) => setReviewDecision(e.target.value)}
                options={REVIEW_DECISIONS.map((d) => ({ value: d, label: ROADMAP_REVIEW_DECISION_LABELS[d] ?? d }))}
              />
              <TextField label="Ghi chú" as="textarea" optional value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
            </div>
            <PrimaryButton disabled={busyKey === "review"} onClick={onReview} style={{ marginTop: "var(--space-4)" }}>
              {busyKey === "review" ? "Đang gửi…" : "Gửi quyết định"}
            </PrimaryButton>
          </Card>
        )}

        {reviews.length > 0 && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-4)" }}>Lịch sử review ({reviews.length})</h2>
            <div className="uikit-row-list">
              {reviews.map((rv) => (
                <div key={rv.id} className="uikit-row">
                  <div>
                    <p style={{ fontWeight: 500, fontSize: 14 }}>{ROADMAP_REVIEW_DECISION_LABELS[rv.decision] ?? rv.decision}</p>
                    {rv.comment && <p style={{ marginTop: 2, fontSize: 13, color: "var(--uikit-slate-500)" }}>{rv.comment}</p>}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>{new Date(rv.createdAt).toLocaleString("vi-VN")}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ---------- milestones ---------- */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-4)" }}>Milestone ({milestones.length})</h2>
          {milestones.length === 0 ? (
            <p className="uikit-empty">Chưa có milestone nào.</p>
          ) : (
            <div className="uikit-stack">
              {milestones.map((m) => {
                const expanded = expandedMilestoneId === m.id;
                return (
                  <div key={m.id} style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-4)" }}>
                    <button
                      type="button"
                      onClick={() => toggleMilestone(m.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "var(--space-4)",
                        width: "100%",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "left",
                        font: "inherit",
                        color: "inherit",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {expanded ? <ChevronDown style={{ width: 16, height: 16, color: "var(--uikit-slate-400)" }} /> : <ChevronRight style={{ width: 16, height: 16, color: "var(--uikit-slate-400)" }} />}
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</p>
                          <p style={{ marginTop: 2, fontSize: 13, color: "var(--uikit-slate-500)" }}>
                            {PRIORITY_LEVEL_LABELS[m.priority] ?? m.priority}
                          </p>
                        </div>
                      </div>
                      <StatusPill tone={toneOf(MILESTONE_STATUS_TONE, m.status)}>
                        {MILESTONE_STATUS_LABELS[m.status] ?? m.status}
                      </StatusPill>
                    </button>

                    {expanded && (
                      <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--uikit-slate-100)" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)" }}>
                          Task ({milestoneTasks[m.id]?.length ?? 0})
                        </p>
                        <div className="uikit-row-list" style={{ marginTop: "var(--space-2)" }}>
                          {(milestoneTasks[m.id] ?? []).map((t) => (
                            <div key={t.id} className="uikit-row">
                              <span style={{ fontSize: 14 }}>{t.title}</span>
                              <StatusPill tone={toneOf(TASK_STATUS_TONE, t.status)}>
                                {TASK_STATUS_LABELS[t.status] ?? t.status}
                              </StatusPill>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: "var(--space-3)" }}>
                          <TextField
                            label="Task mới"
                            value={taskForm(m.id).title}
                            onChange={(e) => setTaskForms({ ...taskForms, [m.id]: { ...taskForm(m.id), title: e.target.value } })}
                          />
                        </div>
                        <GhostButton
                          icon={Plus}
                          disabled={busyKey === `create-task-${m.id}` || !taskForm(m.id).title}
                          onClick={() => onCreateTask(m.id)}
                          className="uikit-mt-4"
                        >
                          {busyKey === `create-task-${m.id}` ? "Đang thêm…" : "Thêm task"}
                        </GhostButton>

                        <div style={{ marginTop: "var(--space-5)" }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)" }}>
                            Gap liên kết ({milestoneGaps[m.id]?.length ?? 0})
                          </p>
                          <div className="uikit-row-list" style={{ marginTop: "var(--space-2)" }}>
                            {(milestoneGaps[m.id] ?? []).map((g) => (
                              <div key={g.id} className="uikit-row">
                                <span style={{ fontSize: 14 }}>{g.title}</span>
                                <StatusPill tone={toneOf(GAP_SEVERITY_TONE, g.severity)}>
                                  {GAP_SEVERITY_LABELS[g.severity] ?? g.severity}
                                </StatusPill>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: "var(--space-3)" }}>
                            <SelectField
                              label="Liên kết gap của case"
                              value={linkGapId[m.id] ?? ""}
                              onChange={(e) => setLinkGapId({ ...linkGapId, [m.id]: e.target.value })}
                              options={[{ value: "", label: "— Chọn gap —" }, ...caseGaps.map((g) => ({ value: g.id, label: g.title }))]}
                            />
                          </div>
                          <GhostButton
                            icon={Link2}
                            disabled={busyKey === `link-gap-${m.id}` || !linkGapId[m.id]}
                            onClick={() => onLinkGap(m.id)}
                            className="uikit-mt-4"
                          >
                            {busyKey === `link-gap-${m.id}` ? "Đang liên kết…" : "Liên kết gap"}
                          </GhostButton>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="uikit-stack" style={{ marginTop: "var(--space-5)" }}>
            <TextField
              label="Tiêu đề milestone mới"
              value={milestoneForm.title}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
            />
            <SelectField
              label="Độ ưu tiên"
              value={milestoneForm.priority}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, priority: e.target.value })}
              options={PRIORITY_LEVELS.map((p) => ({ value: p, label: PRIORITY_LEVEL_LABELS[p] ?? p }))}
            />
            <TextField
              label="Ngày bắt đầu"
              optional
              type="date"
              value={milestoneForm.startDate}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, startDate: e.target.value })}
            />
            <TextField
              label="Hạn hoàn thành"
              optional
              type="date"
              value={milestoneForm.dueDate}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })}
            />
          </div>
          <GhostButton
            icon={Plus}
            disabled={busyKey === "create-milestone" || !milestoneForm.title}
            onClick={onCreateMilestone}
            className="uikit-mt-4"
          >
            {busyKey === "create-milestone" ? "Đang tạo…" : "Thêm milestone"}
          </GhostButton>
        </Card>

        {/* ---------- dependencies ---------- */}
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-4)" }}>Phụ thuộc milestone ({dependencies.length})</h2>
          {dependencies.length === 0 ? (
            <p className="uikit-empty">Chưa có phụ thuộc nào.</p>
          ) : (
            <div className="uikit-row-list">
              {dependencies.map((d) => (
                <div key={d.id} className="uikit-row">
                  <span style={{ fontSize: 14 }}>
                    {milestoneTitle(d.predecessorMilestoneId)} → {milestoneTitle(d.successorMilestoneId)}
                  </span>
                  <StatusPill tone="gray">{DEPENDENCY_TYPE_LABELS[d.dependencyType] ?? d.dependencyType}</StatusPill>
                </div>
              ))}
            </div>
          )}
          <div className="uikit-stack" style={{ marginTop: "var(--space-5)" }}>
            <SelectField
              label="Trước"
              value={depForm.predecessorMilestoneId}
              onChange={(e) => setDepForm({ ...depForm, predecessorMilestoneId: e.target.value })}
              options={[{ value: "", label: "— Chọn milestone —" }, ...milestones.map((m) => ({ value: m.id, label: m.title }))]}
            />
            <SelectField
              label="Sau"
              value={depForm.successorMilestoneId}
              onChange={(e) => setDepForm({ ...depForm, successorMilestoneId: e.target.value })}
              options={[{ value: "", label: "— Chọn milestone —" }, ...milestones.map((m) => ({ value: m.id, label: m.title }))]}
            />
            <SelectField
              label="Loại phụ thuộc"
              value={depForm.dependencyType}
              onChange={(e) => setDepForm({ ...depForm, dependencyType: e.target.value })}
              options={DEPENDENCY_TYPES.map((t) => ({ value: t, label: DEPENDENCY_TYPE_LABELS[t] ?? t }))}
            />
          </div>
          <GhostButton
            icon={Plus}
            disabled={busyKey === "create-dependency" || !depForm.predecessorMilestoneId || !depForm.successorMilestoneId}
            onClick={onCreateDependency}
            className="uikit-mt-4"
          >
            {busyKey === "create-dependency" ? "Đang thêm…" : "Thêm phụ thuộc"}
          </GhostButton>
        </Card>
      </div>
    </Shell>
  );
}
