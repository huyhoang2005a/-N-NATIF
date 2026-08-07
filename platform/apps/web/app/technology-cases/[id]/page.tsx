"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import type {
  AssessmentCriterionResponse,
  AssessmentScoreResponse,
  CaseMemberResponse,
  CaseOrganizationResponse,
  EvidenceResponse,
  GapResponse,
  MeResponse,
  OrganizationResponse,
  ReadinessAssessmentResponse,
  RoadmapMilestoneResponse,
  RoadmapResponse,
  TechnologyCaseResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import {
  ASSESSMENT_STATUS_LABELS,
  CASE_MEMBER_ROLE_LABELS,
  CASE_ORGANIZATION_ROLE_LABELS,
  GAP_SEVERITY_LABELS,
  MILESTONE_STATUS_LABELS,
  PLATFORM_ROLE_LABELS,
  TECHNOLOGY_CASE_STATUS_LABELS,
} from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import {
  toneOf,
  ASSESSMENT_STATUS_TONE,
  GAP_SEVERITY_TONE,
  MILESTONE_STATUS_TONE,
  TECHNOLOGY_CASE_STATUS_TONE,
} from "../../../lib/tone";
import { BackLink, Card, GhostButton, PrimaryButton, SelectField, Shell, StatusDot, StatusPill, Tabs, TextField } from "../../../components/ui";

const TABS = ["Tổng quan", "Bằng chứng", "Đánh giá", "Gap", "Lộ trình"] as const;
const CASE_MEMBER_ROLES = Object.keys(CASE_MEMBER_ROLE_LABELS);
const CASE_ORGANIZATION_ROLES = Object.keys(CASE_ORGANIZATION_ROLE_LABELS).filter((role) => role !== "OWNING_ORGANIZATION");
const TECHNOLOGY_CASE_STATUSES = Object.keys(TECHNOLOGY_CASE_STATUS_LABELS);

export default function TechnologyCaseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const caseId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [myOrganizations, setMyOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [technologyCase, setTechnologyCase] = useState<TechnologyCaseResponse | null>(null);
  const [owningOrg, setOwningOrg] = useState<OrganizationResponse | null>(null);
  const [members, setMembers] = useState<CaseMemberResponse[] | null>(null);
  const [caseOrganizations, setCaseOrganizations] = useState<CaseOrganizationResponse[] | null>(null);
  const [evidence, setEvidence] = useState<EvidenceResponse[] | null>(null);
  const [assessments, setAssessments] = useState<ReadinessAssessmentResponse[] | null>(null);
  const [criteria, setCriteria] = useState<AssessmentCriterionResponse[]>([]);
  const [scores, setScores] = useState<AssessmentScoreResponse[]>([]);
  const [gaps, setGaps] = useState<GapResponse[] | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapResponse[] | null>(null);
  const [milestones, setMilestones] = useState<RoadmapMilestoneResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Tổng quan");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({
    resourceVersionId: "",
    title: "",
    claim: "",
    relevanceNote: "",
    citationSnippet: "",
  });

  async function load() {
    const [meResponse, myOrgs] = await Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
    ]);
    const tc = await authFetch<TechnologyCaseResponse>(`/technology-cases/${caseId}`);
    const [org, memberRows, caseOrgRows, evidenceRows, assessmentRows, gapRows, roadmapRows] = await Promise.all([
      authFetch<OrganizationResponse>(`/organizations/${tc.owningOrganizationId}`),
      authFetch<CaseMemberResponse[]>(`/technology-cases/${caseId}/members`),
      authFetch<CaseOrganizationResponse[]>(`/technology-cases/${caseId}/organizations`),
      authFetch<EvidenceResponse[]>(`/technology-cases/${caseId}/evidence`),
      authFetch<ReadinessAssessmentResponse[]>(`/technology-cases/${caseId}/assessments`),
      authFetch<GapResponse[]>(`/technology-cases/${caseId}/gaps`),
      authFetch<RoadmapResponse[]>(`/technology-cases/${caseId}/roadmaps`),
    ]);
    const latestAssessment = assessmentRows[0];
    const [criterionRows, scoreRows] = latestAssessment
      ? await Promise.all([
          authFetch<AssessmentCriterionResponse[]>(`/assessment-frameworks/${latestAssessment.frameworkId}/criteria`),
          authFetch<AssessmentScoreResponse[]>(`/assessments/${latestAssessment.id}/scores`),
        ])
      : [[], []];
    const latestRoadmap = roadmapRows[0];
    const milestoneRows = latestRoadmap
      ? await authFetch<RoadmapMilestoneResponse[]>(`/roadmaps/${latestRoadmap.id}/milestones`)
      : [];

    setMe(meResponse);
    setMyOrganizations(myOrgs);
    setTechnologyCase(tc);
    setOwningOrg(org);
    setMembers(memberRows);
    setCaseOrganizations(caseOrgRows);
    setEvidence(evidenceRows);
    setAssessments(assessmentRows);
    setCriteria(criterionRows);
    setScores(scoreRows);
    setGaps(gapRows);
    setRoadmaps(roadmapRows);
    setMilestones(milestoneRows);
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
      setLoadError("Không tải được dữ liệu case.");
    });
    // Intentionally depends only on caseId — `load` closes over state that would
    // otherwise cause a dependency-array footgun; router doesn't change across renders.
  }, [caseId]);

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

  function onAddEvidence() {
    return runAction("add-evidence", async () => {
      await authFetch(`/technology-cases/${caseId}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          resourceVersionId: evidenceForm.resourceVersionId,
          title: evidenceForm.title,
          claim: evidenceForm.claim,
          relevanceNote: evidenceForm.relevanceNote,
          citation: { snippet: evidenceForm.citationSnippet },
        }),
      });
      setEvidenceForm({ resourceVersionId: "", title: "", claim: "", relevanceNote: "", citationSnippet: "" });
      setShowEvidenceForm(false);
      await load();
    });
  }

  function onStartAssessment() {
    return runAction("start-assessment", async () => {
      const created = await authFetch<ReadinessAssessmentResponse>(`/technology-cases/${caseId}/assessments`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/assessments/${created.id}`);
    });
  }

  // ---------- quản trị case (nâng cao) ----------
  const [memberForm, setMemberForm] = useState({ userId: "", organizationId: "", role: CASE_MEMBER_ROLES[0] ?? "" });

  function onAddMember() {
    return runAction("add-member", async () => {
      await authFetch(`/technology-cases/${caseId}/members`, { method: "POST", body: JSON.stringify(memberForm) });
      setMemberForm({ userId: "", organizationId: "", role: CASE_MEMBER_ROLES[0] ?? "" });
      await load();
    });
  }

  const [orgForm, setOrgForm] = useState({ organizationId: "", role: CASE_ORGANIZATION_ROLES[0] ?? "" });

  function onAddOrganization() {
    return runAction("add-org", async () => {
      await authFetch(`/technology-cases/${caseId}/organizations`, { method: "POST", body: JSON.stringify(orgForm) });
      setOrgForm({ organizationId: "", role: CASE_ORGANIZATION_ROLES[0] ?? "" });
      await load();
    });
  }

  const [transitionStatus, setTransitionStatus] = useState(TECHNOLOGY_CASE_STATUSES[1] ?? "");
  const [transitionReason, setTransitionReason] = useState("");

  function onTransition() {
    return runAction("transition", async () => {
      await authFetch(`/technology-cases/${caseId}/transitions`, {
        method: "POST",
        body: JSON.stringify({ toStatus: transitionStatus, reason: transitionReason || undefined }),
      });
      await load();
    });
  }

  if (!me || !myOrganizations) {
    if (loadError) {
      return (
        <div className="uikit-main" style={{ maxWidth: 720, margin: "0 auto" }}>
          <p className="uikit-alert-error" role="alert">
            {loadError}
          </p>
        </div>
      );
    }
    return null;
  }

  const roleLabel = PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole;
  const nav = navForPersona(personaOf(me, myOrganizations), me.platformRole === "PLATFORM_ADMIN");

  if (loadError) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        <p className="uikit-alert-error" role="alert">
          {loadError}
        </p>
      </Shell>
    );
  }

  if (!technologyCase || !owningOrg || !members || !caseOrganizations || !evidence || !assessments || !gaps || !roadmaps) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        {null}
      </Shell>
    );
  }

  const owner = members.find((m) => m.role === "OWNER");
  const ownerLabel = owner ? (owner.userId === me.userId ? me.displayName : owner.userId.slice(0, 8)) : "—";
  const latestAssessment = assessments[0];
  const latestRoadmap = roadmaps[0];

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
      <div className="uikit-stack">
        <BackLink href="/technology-cases">Quay lại danh sách case</BackLink>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <div>
            <h1 style={{ fontSize: 22 }}>{technologyCase.title}</h1>
            <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--uikit-slate-500)" }}>{owningOrg.name}</p>
          </div>
          <StatusDot
            tone={toneOf(TECHNOLOGY_CASE_STATUS_TONE, technologyCase.lifecycleStatus)}
            label={TECHNOLOGY_CASE_STATUS_LABELS[technologyCase.lifecycleStatus] ?? technologyCase.lifecycleStatus}
          />
        </div>

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        <Tabs tabs={[...TABS]} active={tab} onChange={(t) => setTab(t as (typeof TABS)[number])} />

        {tab === "Tổng quan" && (
          <Card>
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", fontSize: 14 }}>
              <div>
                <dt style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>Chủ trì case</dt>
                <dd style={{ margin: 0, color: "var(--uikit-slate-900)" }}>{ownerLabel}</dd>
              </div>
              <div>
                <dt style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>Tổ chức chủ trì</dt>
                <dd style={{ margin: 0, color: "var(--uikit-slate-900)" }}>{owningOrg.name}</dd>
              </div>
              <div>
                <dt style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>Mô tả</dt>
                <dd style={{ margin: 0, color: "var(--uikit-slate-900)" }}>{technologyCase.description || "Chưa có mô tả."}</dd>
              </div>
              <div>
                <dt style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>Cập nhật gần nhất</dt>
                <dd style={{ margin: 0, color: "var(--uikit-slate-900)" }}>
                  {new Date(technologyCase.updatedAt).toLocaleString("vi-VN")}
                </dd>
              </div>
            </dl>
          </Card>
        )}

        {tab === "Bằng chứng" && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>Bằng chứng đã liên kết</h2>
              <button
                type="button"
                onClick={() => setShowEvidenceForm((v) => !v)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--uikit-indigo-700)" }}
              >
                {showEvidenceForm ? "Đóng" : "+ Thêm bằng chứng"}
              </button>
            </div>

            {evidence.length === 0 ? (
              <p className="uikit-empty">
                Chưa có bằng chứng nào. Thêm bằng chứng để làm cơ sở cho đánh giá mức độ sẵn
                sàng công nghệ.
              </p>
            ) : (
              <div className="uikit-stack">
                {evidence.map((e) => (
                  <div key={e.id} style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-900)" }}>{e.title}</p>
                    <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>{e.claim}</p>
                  </div>
                ))}
              </div>
            )}

            {showEvidenceForm && (
              <div className="uikit-stack" style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--uikit-slate-100)" }}>
                <TextField
                  label="Resource Version ID"
                  hint="Chưa có Resource Catalog để chọn trực quan — dán UUID của resource version đã đăng ở trang Tài nguyên."
                  value={evidenceForm.resourceVersionId}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, resourceVersionId: e.target.value })}
                />
                <TextField label="Tiêu đề" value={evidenceForm.title} onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })} />
                <TextField
                  label="Nhận định (claim)"
                  as="textarea"
                  value={evidenceForm.claim}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, claim: e.target.value })}
                />
                <TextField
                  label="Mức độ liên quan"
                  as="textarea"
                  value={evidenceForm.relevanceNote}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, relevanceNote: e.target.value })}
                />
                <TextField
                  label="Trích dẫn (snippet)"
                  as="textarea"
                  value={evidenceForm.citationSnippet}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, citationSnippet: e.target.value })}
                />
                <PrimaryButton
                  disabled={
                    busyKey === "add-evidence" ||
                    !evidenceForm.resourceVersionId ||
                    !evidenceForm.title ||
                    !evidenceForm.claim ||
                    !evidenceForm.relevanceNote ||
                    !evidenceForm.citationSnippet
                  }
                  onClick={onAddEvidence}
                >
                  {busyKey === "add-evidence" ? "Đang thêm…" : "Thêm bằng chứng"}
                </PrimaryButton>
              </div>
            )}
          </Card>
        )}

        {tab === "Đánh giá" && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-3)" }}>Đánh giá mức độ sẵn sàng</h2>
            {!latestAssessment ? (
              <>
                <p className="uikit-empty">Chưa có đánh giá nào. Nộp đánh giá đầu tiên để đo mức độ sẵn sàng công nghệ.</p>
                <PrimaryButton disabled={busyKey === "start-assessment"} onClick={onStartAssessment}>
                  {busyKey === "start-assessment" ? "Đang tạo…" : "Bắt đầu đánh giá"}
                </PrimaryButton>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600 }}>
                    {latestAssessment.compositeScore != null ? latestAssessment.compositeScore.toFixed(1) : "—"}
                  </span>
                  <StatusPill tone={toneOf(ASSESSMENT_STATUS_TONE, latestAssessment.status)}>
                    {ASSESSMENT_STATUS_LABELS[latestAssessment.status] ?? latestAssessment.status}
                  </StatusPill>
                  <Link href={`/assessments/${latestAssessment.id}`} style={{ marginLeft: "auto", fontSize: 13, color: "var(--uikit-indigo-700)" }}>
                    Xem chi tiết →
                  </Link>
                </div>
                <div className="uikit-stack">
                  {criteria.map((c) => {
                    const score = scores.find((s) => s.criterionId === c.id);
                    return (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span style={{ color: "var(--uikit-slate-700)" }}>{c.title}</span>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--uikit-slate-900)" }}>
                          {score ? `${score.score}/${c.maxScore}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        )}

        {tab === "Gap" && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-3)" }}>Khoảng trống cần xử lý</h2>
            {gaps.length === 0 ? (
              <p className="uikit-empty">Chưa có gap nào được ghi nhận từ đánh giá.</p>
            ) : (
              <div className="uikit-stack">
                {gaps.map((g) => (
                  <Link
                    key={g.id}
                    href={`/gaps/${g.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: "1px solid var(--uikit-slate-200)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--space-3)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{g.title}</span>
                    <StatusPill tone={toneOf(GAP_SEVERITY_TONE, g.severity)}>
                      {GAP_SEVERITY_LABELS[g.severity] ?? g.severity}
                    </StatusPill>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "Lộ trình" && (
          <Card>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-3)" }}>Lộ trình thương mại hoá</h2>
            {!latestRoadmap ? (
              <p className="uikit-empty">Chưa có roadmap nào cho case này.</p>
            ) : (
              <>
                <Link href={`/roadmaps/${latestRoadmap.id}`} style={{ fontSize: 13, color: "var(--uikit-indigo-700)" }}>
                  {latestRoadmap.title} · v{latestRoadmap.versionNo} →
                </Link>
                {milestones.length === 0 ? (
                  <p className="uikit-empty">Roadmap chưa có milestone nào.</p>
                ) : (
                  <div style={{ marginTop: "var(--space-4)" }}>
                    {milestones.map((m, i) => (
                      <div key={m.id} style={{ display: "flex", gap: "var(--space-3)" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span
                            className={`uikit-dot uikit-dot--${toneOf(MILESTONE_STATUS_TONE, m.status)}`}
                            style={{ marginTop: 6 }}
                          />
                          {i < milestones.length - 1 && (
                            <span style={{ width: 1, flex: 1, background: "var(--uikit-slate-200)" }} />
                          )}
                        </div>
                        <div style={{ paddingBottom: "var(--space-5)" }}>
                          <p style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</p>
                          <StatusDot
                            tone={toneOf(MILESTONE_STATUS_TONE, m.status)}
                            label={MILESTONE_STATUS_LABELS[m.status] ?? m.status}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        <details className="uikit-disclosure">
          <summary>Quản trị case (nâng cao)</summary>
          <div className="uikit-disclosure__body uikit-stack">
            <Card>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-3)" }}>Thành viên ({members.length})</h2>
              {members.length === 0 ? (
                <p className="uikit-empty">Chưa có thành viên nào.</p>
              ) : (
                <div className="uikit-row-list">
                  {members.map((m) => (
                    <div key={m.id} className="uikit-row">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{m.userId.slice(0, 8)}</span>
                      <span style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>{CASE_MEMBER_ROLE_LABELS[m.role] ?? m.role}</span>
                      <StatusPill tone={m.status === "ACTIVE" ? "green" : "gray"}>{m.status}</StatusPill>
                    </div>
                  ))}
                </div>
              )}
              <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
                <TextField label="User ID" hint="UUID người dùng" value={memberForm.userId} onChange={(e) => setMemberForm({ ...memberForm, userId: e.target.value })} />
                <TextField
                  label="Organization ID"
                  hint="UUID tổ chức của người này"
                  value={memberForm.organizationId}
                  onChange={(e) => setMemberForm({ ...memberForm, organizationId: e.target.value })}
                />
                <SelectField
                  label="Vai trò"
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                  options={CASE_MEMBER_ROLES.map((r) => ({ value: r, label: CASE_MEMBER_ROLE_LABELS[r] ?? r }))}
                />
              </div>
              <GhostButton
                icon={UserPlus}
                disabled={busyKey === "add-member" || !memberForm.userId || !memberForm.organizationId}
                onClick={onAddMember}
                className="uikit-mt-4"
              >
                {busyKey === "add-member" ? "Đang thêm…" : "Thêm thành viên"}
              </GhostButton>
            </Card>

            <Card>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-3)" }}>
                Tổ chức liên kết ({caseOrganizations.length})
              </h2>
              {caseOrganizations.length === 0 ? (
                <p className="uikit-empty">Chưa có tổ chức liên kết nào ngoài tổ chức chủ trì.</p>
              ) : (
                <div className="uikit-row-list">
                  {caseOrganizations.map((o) => (
                    <div key={o.id} className="uikit-row">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{o.organizationId.slice(0, 8)}</span>
                      <span style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>{CASE_ORGANIZATION_ROLE_LABELS[o.role] ?? o.role}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
                <TextField
                  label="Organization ID"
                  hint="UUID tổ chức"
                  value={orgForm.organizationId}
                  onChange={(e) => setOrgForm({ ...orgForm, organizationId: e.target.value })}
                />
                <SelectField
                  label="Vai trò"
                  value={orgForm.role}
                  onChange={(e) => setOrgForm({ ...orgForm, role: e.target.value })}
                  options={CASE_ORGANIZATION_ROLES.map((r) => ({ value: r, label: CASE_ORGANIZATION_ROLE_LABELS[r] ?? r }))}
                />
              </div>
              <GhostButton
                icon={Plus}
                disabled={busyKey === "add-org" || !orgForm.organizationId}
                onClick={onAddOrganization}
                className="uikit-mt-4"
              >
                {busyKey === "add-org" ? "Đang liên kết…" : "Liên kết tổ chức"}
              </GhostButton>
            </Card>

            <Card>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-2)" }}>Chuyển trạng thái thủ công</h2>
              <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
                Hầu hết trạng thái case tự chuyển khi có evidence/đánh giá/gap/roadmap mới. Chỉ
                dùng mục này khi thật sự cần can thiệp thủ công.
              </p>
              <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
                <SelectField
                  label="Trạng thái đích"
                  value={transitionStatus}
                  onChange={(e) => setTransitionStatus(e.target.value)}
                  options={TECHNOLOGY_CASE_STATUSES.map((s) => ({ value: s, label: TECHNOLOGY_CASE_STATUS_LABELS[s] ?? s }))}
                />
                <TextField label="Lý do" optional value={transitionReason} onChange={(e) => setTransitionReason(e.target.value)} />
              </div>
              <GhostButton disabled={busyKey === "transition"} onClick={onTransition} className="uikit-mt-4">
                {busyKey === "transition" ? "Đang chuyển…" : "Chuyển trạng thái"}
              </GhostButton>
            </Card>
          </div>
        </details>
      </div>
    </Shell>
  );
}
