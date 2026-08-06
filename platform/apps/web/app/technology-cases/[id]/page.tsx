"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  CaseMemberResponse,
  CaseOrganizationResponse,
  EvidenceResponse,
  GapResponse,
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
  assessmentStatusTone,
  CASE_MEMBER_ROLE_LABELS,
  CASE_ORGANIZATION_ROLE_LABELS,
  EVIDENCE_STATUS_LABELS,
  evidenceStatusTone,
  GAP_SEVERITY_LABELS,
  GAP_STATUS_LABELS,
  gapSeverityTone,
  gapStatusTone,
  ROADMAP_STATUS_LABELS,
  roadmapStatusTone,
  TECHNOLOGY_CASE_STATUS_LABELS,
  technologyCaseStatusTone,
} from "../../../lib/labels";
import { getAccessToken } from "../../../lib/session";
import { Button, ButtonLink, TextLink } from "../../_components/ui/Button";
import { Card, CardBody, CardGrid, CardHeader } from "../../_components/ui/Card";
import { EmptyState } from "../../_components/ui/EmptyState";
import { Meter } from "../../_components/ui/Meter";
import { ProvenanceRail } from "../../_components/ui/ProvenanceRail";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { Table } from "../../_components/ui/Table";
import { Timeline } from "../../_components/ui/Timeline";
import { FormField } from "../../_components/FormField";
import { SiteHeader } from "../../_components/SiteHeader";

const CASE_MEMBER_ROLES = Object.keys(CASE_MEMBER_ROLE_LABELS);
const CASE_ORGANIZATION_ROLES = Object.keys(CASE_ORGANIZATION_ROLE_LABELS).filter(
  (role) => role !== "OWNING_ORGANIZATION",
);
const TECHNOLOGY_CASE_STATUSES = Object.keys(TECHNOLOGY_CASE_STATUS_LABELS);
const GAP_SEVERITIES = Object.keys(GAP_SEVERITY_LABELS);
const CRITICAL_OPEN_GAP_STATUSES = ["OPEN", "IN_PROGRESS"];

export default function TechnologyCaseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const caseId = params.id;

  const [technologyCase, setTechnologyCase] = useState<TechnologyCaseResponse | null>(null);
  const [owningOrg, setOwningOrg] = useState<OrganizationResponse | null>(null);
  const [members, setMembers] = useState<CaseMemberResponse[] | null>(null);
  const [organizations, setOrganizations] = useState<CaseOrganizationResponse[] | null>(null);
  const [evidence, setEvidence] = useState<EvidenceResponse[] | null>(null);
  const [assessments, setAssessments] = useState<ReadinessAssessmentResponse[] | null>(null);
  const [gaps, setGaps] = useState<GapResponse[] | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapResponse[] | null>(null);
  const [milestones, setMilestones] = useState<RoadmapMilestoneResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    const tc = await authFetch<TechnologyCaseResponse>(`/technology-cases/${caseId}`);
    const [org, memberRows, orgRows, evidenceRows, assessmentRows, gapRows, roadmapRows] = await Promise.all([
      authFetch<OrganizationResponse>(`/organizations/${tc.owningOrganizationId}`),
      authFetch<CaseMemberResponse[]>(`/technology-cases/${caseId}/members`),
      authFetch<CaseOrganizationResponse[]>(`/technology-cases/${caseId}/organizations`),
      authFetch<EvidenceResponse[]>(`/technology-cases/${caseId}/evidence`),
      authFetch<ReadinessAssessmentResponse[]>(`/technology-cases/${caseId}/assessments`),
      authFetch<GapResponse[]>(`/technology-cases/${caseId}/gaps`),
      authFetch<RoadmapResponse[]>(`/technology-cases/${caseId}/roadmaps`),
    ]);
    const latestRoadmap = roadmapRows[0];
    const milestoneRows = latestRoadmap
      ? await authFetch<RoadmapMilestoneResponse[]>(`/roadmaps/${latestRoadmap.id}/milestones`)
      : [];

    setTechnologyCase(tc);
    setOwningOrg(org);
    setMembers(memberRows);
    setOrganizations(orgRows);
    setEvidence(evidenceRows);
    setAssessments(assessmentRows);
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

  // ---------- transition (nâng cao — hầu hết case chuyển trạng thái tự động) ----------
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

  // ---------- members ----------
  const [memberForm, setMemberForm] = useState({ userId: "", organizationId: "", role: CASE_MEMBER_ROLES[0] ?? "" });

  function onAddMember() {
    return runAction("add-member", async () => {
      await authFetch(`/technology-cases/${caseId}/members`, { method: "POST", body: JSON.stringify(memberForm) });
      setMemberForm({ userId: "", organizationId: "", role: CASE_MEMBER_ROLES[0] ?? "" });
      await load();
    });
  }

  // ---------- organizations ----------
  const [orgForm, setOrgForm] = useState({ organizationId: "", role: CASE_ORGANIZATION_ROLES[0] ?? "" });

  function onAddOrganization() {
    return runAction("add-org", async () => {
      await authFetch(`/technology-cases/${caseId}/organizations`, { method: "POST", body: JSON.stringify(orgForm) });
      setOrgForm({ organizationId: "", role: CASE_ORGANIZATION_ROLES[0] ?? "" });
      await load();
    });
  }

  // ---------- evidence ----------
  const [evidenceForm, setEvidenceForm] = useState({
    resourceVersionId: "",
    title: "",
    claim: "",
    relevanceNote: "",
    citationSnippet: "",
  });

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
      await load();
    });
  }

  // ---------- assessments ----------
  function onCreateAssessment() {
    return runAction("create-assessment", async () => {
      const created = await authFetch<ReadinessAssessmentResponse>(`/technology-cases/${caseId}/assessments`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/assessments/${created.id}`);
    });
  }

  // ---------- gaps ----------
  const [gapForm, setGapForm] = useState({
    title: "",
    description: "",
    severity: GAP_SEVERITIES[0] ?? "LOW",
    sourceAssessmentId: "",
    evidenceIds: "",
  });

  function onCreateGap() {
    return runAction("create-gap", async () => {
      const created = await authFetch<GapResponse>(`/technology-cases/${caseId}/gaps`, {
        method: "POST",
        body: JSON.stringify({
          title: gapForm.title,
          description: gapForm.description,
          severity: gapForm.severity,
          sourceAssessmentId: gapForm.sourceAssessmentId || undefined,
          evidenceIds: gapForm.evidenceIds.split(",").map((v) => v.trim()).filter(Boolean),
        }),
      });
      setGapForm({ title: "", description: "", severity: GAP_SEVERITIES[0] ?? "LOW", sourceAssessmentId: "", evidenceIds: "" });
      router.push(`/gaps/${created.id}`);
    });
  }

  // ---------- roadmaps ----------
  const [roadmapTitle, setRoadmapTitle] = useState("");

  function onCreateRoadmap() {
    return runAction("create-roadmap", async () => {
      const created = await authFetch<RoadmapResponse>(`/technology-cases/${caseId}/roadmaps`, {
        method: "POST",
        body: JSON.stringify({ title: roadmapTitle }),
      });
      router.push(`/roadmaps/${created.id}`);
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

  if (!technologyCase || !owningOrg || !members || !organizations || !evidence || !assessments || !gaps || !roadmaps) {
    return (
      <div className="shell">
        <SiteHeader />
      </div>
    );
  }

  const owner = members.find((m) => m.role === "OWNER");
  const latestAssessment = assessments[0];
  const openCriticalGaps = gaps.filter((g) => g.severity === "CRITICAL" && CRITICAL_OPEN_GAP_STATUSES.includes(g.status));
  const latestRoadmap = roadmaps[0];

  return (
    <div className="shell">
      <SiteHeader />
      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)", maxWidth: 920 }}>
        <TextLink href="/technology-cases">← Technology Case</TextLink>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "var(--space-4)",
            marginTop: "var(--space-4)",
          }}
        >
          <div>
            <h1 style={{ fontSize: 28 }}>{technologyCase.title}</h1>
            <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--ink-400)", fontFamily: "var(--font-mono)" }}>
              {owningOrg.name} · {technologyCase.slug}
            </p>
          </div>
          <StatusBadge
            tone={technologyCaseStatusTone(technologyCase.lifecycleStatus)}
            label={TECHNOLOGY_CASE_STATUS_LABELS[technologyCase.lifecycleStatus] ?? technologyCase.lifecycleStatus}
          />
        </div>

        {actionError && (
          <p className="alert alert-error" role="alert" style={{ marginTop: "var(--space-5)" }}>
            {actionError}
          </p>
        )}

        {/* ---------- Overview + Readiness Snapshot ---------- */}
        <CardGrid>
          <Card className="ui-card--top">
            <CardHeader title="Tổng quan" />
            <CardBody>
              <p style={{ fontSize: 14, color: "var(--ink-900)" }}>
                {technologyCase.description || "Chưa có mô tả công nghệ."}
              </p>
              <dl style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-2)", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                  <dt style={{ color: "var(--ink-400)" }}>Chủ trì</dt>
                  <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{owner ? owner.userId.slice(0, 8) : "—"}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                  <dt style={{ color: "var(--ink-400)" }}>Tổ chức chủ trì</dt>
                  <dd style={{ margin: 0 }}>{owningOrg.name}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Readiness Snapshot" />
            <CardBody>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
                <div>
                  <span style={{ fontSize: 12, color: "var(--ink-400)" }}>Composite score</span>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, marginTop: 2 }}>
                    {latestAssessment?.compositeScore != null ? `${latestAssessment.compositeScore.toFixed(0)}/100` : "—"}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-400)" }}>Gap</span>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, marginTop: 2 }}>
                    {gaps.length} {gaps.length > 0 && <span style={{ fontSize: 13, fontWeight: 400 }}>mở</span>}
                  </p>
                </div>
              </div>
              {latestAssessment?.compositeScore != null && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <Meter value={latestAssessment.compositeScore} />
                </div>
              )}
              {openCriticalGaps.length > 0 && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <StatusBadge tone="danger" label={`${openCriticalGaps.length} gap nghiêm trọng chưa xử lý`} />
                </div>
              )}
              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
                {latestAssessment && (
                  <ButtonLink href={`/assessments/${latestAssessment.id}`} variant="secondary" size="sm">
                    Xem đánh giá →
                  </ButtonLink>
                )}
                {gaps.length > 0 && (
                  <ButtonLink href={`/gaps/${gaps[0]!.id}`} variant="secondary" size="sm">
                    Xem gap →
                  </ButtonLink>
                )}
              </div>
            </CardBody>
          </Card>
        </CardGrid>

        {/* ---------- members ---------- */}
        <Card>
          <CardHeader title={`Thành viên (${members.length})`} />
          <CardBody>
            {members.length === 0 ? (
              <EmptyState message="Chưa có thành viên nào. Thêm thành viên để cùng cộng tác trên case này." />
            ) : (
              <Table columns={["Người dùng", "Vai trò", "Trạng thái"]}>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{m.userId.slice(0, 8)}</td>
                    <td>{CASE_MEMBER_ROLE_LABELS[m.role] ?? m.role}</td>
                    <td>
                      <StatusBadge tone={m.status === "ACTIVE" ? "ok" : "neutral"} label={m.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}

            <details className="ui-disclosure" style={{ marginTop: "var(--space-5)" }}>
              <summary>Thêm thành viên</summary>
              <div className="ui-disclosure__body">
                <div className="field-row">
                  <FormField label="User ID" hint="UUID người dùng">
                    <input value={memberForm.userId} onChange={(e) => setMemberForm({ ...memberForm, userId: e.target.value })} />
                  </FormField>
                  <FormField label="Organization ID" hint="UUID tổ chức của người này">
                    <input
                      value={memberForm.organizationId}
                      onChange={(e) => setMemberForm({ ...memberForm, organizationId: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Vai trò">
                    <select value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}>
                      {CASE_MEMBER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {CASE_MEMBER_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busyKey === "add-member" || !memberForm.userId || !memberForm.organizationId}
                  onClick={onAddMember}
                  className="ui-mt-4"
                >
                  {busyKey === "add-member" ? "Đang thêm…" : "Thêm thành viên"}
                </Button>
              </div>
            </details>
          </CardBody>
        </Card>

        {/* ---------- organizations ---------- */}
        <Card>
          <CardHeader title={`Tổ chức liên kết (${organizations.length})`} />
          <CardBody>
            {organizations.length === 0 ? (
              <EmptyState message="Chưa có tổ chức liên kết nào ngoài tổ chức chủ trì." />
            ) : (
              <Table columns={["Tổ chức", "Vai trò"]}>
                {organizations.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{o.organizationId.slice(0, 8)}</td>
                    <td>{CASE_ORGANIZATION_ROLE_LABELS[o.role] ?? o.role}</td>
                  </tr>
                ))}
              </Table>
            )}

            <details className="ui-disclosure" style={{ marginTop: "var(--space-5)" }}>
              <summary>Liên kết tổ chức</summary>
              <div className="ui-disclosure__body">
                <div className="field-row">
                  <FormField label="Organization ID" hint="UUID tổ chức">
                    <input value={orgForm.organizationId} onChange={(e) => setOrgForm({ ...orgForm, organizationId: e.target.value })} />
                  </FormField>
                  <FormField label="Vai trò">
                    <select value={orgForm.role} onChange={(e) => setOrgForm({ ...orgForm, role: e.target.value })}>
                      {CASE_ORGANIZATION_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {CASE_ORGANIZATION_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busyKey === "add-org" || !orgForm.organizationId}
                  onClick={onAddOrganization}
                  className="ui-mt-4"
                >
                  {busyKey === "add-org" ? "Đang liên kết…" : "Liên kết tổ chức"}
                </Button>
              </div>
            </details>
          </CardBody>
        </Card>

        {/* ---------- evidence — signature ProvenanceRail ---------- */}
        <Card>
          <CardHeader title={`Bằng chứng (${evidence.length})`} />
          <CardBody>
            {evidence.length === 0 ? (
              <EmptyState message="Chưa có bằng chứng nào. Thêm bằng chứng để làm cơ sở cho đánh giá readiness." />
            ) : (
              <ProvenanceRail
                items={evidence.map((e) => ({
                  id: e.id,
                  claim: e.claim,
                  locator: `${e.title} · v${e.resourceVersionId.slice(0, 8)}`,
                  action: <StatusBadge tone={evidenceStatusTone(e.status)} label={EVIDENCE_STATUS_LABELS[e.status] ?? e.status} />,
                }))}
              />
            )}
            <p style={{ marginTop: "var(--space-4)", fontSize: 12, color: "var(--ink-400)" }}>
              Chưa có giao diện Resource Catalog (Phase 2) — cần dán sẵn UUID của resource version đã tồn tại.
            </p>

            <details className="ui-disclosure" style={{ marginTop: "var(--space-4)" }}>
              <summary>Thêm bằng chứng</summary>
              <div className="ui-disclosure__body form-stack">
                <FormField label="Resource Version ID" hint="UUID">
                  <input
                    value={evidenceForm.resourceVersionId}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, resourceVersionId: e.target.value })}
                  />
                </FormField>
                <FormField label="Tiêu đề">
                  <input value={evidenceForm.title} onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })} />
                </FormField>
                <FormField label="Nhận định (claim)">
                  <textarea rows={2} value={evidenceForm.claim} onChange={(e) => setEvidenceForm({ ...evidenceForm, claim: e.target.value })} />
                </FormField>
                <FormField label="Mức độ liên quan">
                  <textarea
                    rows={2}
                    value={evidenceForm.relevanceNote}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, relevanceNote: e.target.value })}
                  />
                </FormField>
                <FormField label="Trích dẫn (citation snippet)">
                  <textarea
                    rows={2}
                    value={evidenceForm.citationSnippet}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, citationSnippet: e.target.value })}
                  />
                </FormField>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={
                    busyKey === "add-evidence" ||
                    !evidenceForm.resourceVersionId ||
                    !evidenceForm.title ||
                    !evidenceForm.claim ||
                    !evidenceForm.relevanceNote ||
                    !evidenceForm.citationSnippet
                  }
                  onClick={onAddEvidence}
                  style={{ alignSelf: "flex-start" }}
                >
                  {busyKey === "add-evidence" ? "Đang thêm…" : "Thêm bằng chứng"}
                </Button>
              </div>
            </details>
          </CardBody>
        </Card>

        {/* ---------- assessments — rollup, chi tiết nhập điểm ở trang riêng ---------- */}
        <Card>
          <CardHeader
            title={`Đánh giá (${assessments.length})`}
            action={
              <Button variant="primary" size="sm" disabled={busyKey === "create-assessment"} onClick={onCreateAssessment}>
                {busyKey === "create-assessment" ? "Đang tạo…" : "Bắt đầu đánh giá mới"}
              </Button>
            }
          />
          <CardBody>
            {assessments.length === 0 ? (
              <EmptyState message="Chưa có đợt đánh giá nào. Bắt đầu đánh giá đầu tiên để đo mức độ sẵn sàng công nghệ." />
            ) : (
              <Table columns={["Đánh giá", "Composite score", "Trạng thái"]}>
                {assessments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <TextLink href={`/assessments/${a.id}`}>Đánh giá {a.id.slice(0, 8)}</TextLink>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{a.compositeScore != null ? a.compositeScore.toFixed(1) : "—"}</td>
                    <td>
                      <StatusBadge tone={assessmentStatusTone(a.status)} label={ASSESSMENT_STATUS_LABELS[a.status] ?? a.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </CardBody>
        </Card>

        {/* ---------- gaps ---------- */}
        <Card>
          <CardHeader title={`Khoảng trống — Gap (${gaps.length})`} />
          <CardBody>
            {gaps.length === 0 ? (
              <EmptyState message="Chưa có gap nào được ghi nhận từ đánh giá." />
            ) : (
              <Table columns={["Gap", "Mức độ", "Trạng thái"]}>
                {gaps.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <TextLink href={`/gaps/${g.id}`}>{g.title}</TextLink>
                    </td>
                    <td>
                      <StatusBadge tone={gapSeverityTone(g.severity)} label={GAP_SEVERITY_LABELS[g.severity] ?? g.severity} />
                    </td>
                    <td>
                      <StatusBadge tone={gapStatusTone(g.status)} label={GAP_STATUS_LABELS[g.status] ?? g.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}

            <details className="ui-disclosure" style={{ marginTop: "var(--space-5)" }}>
              <summary>Ghi nhận gap mới</summary>
              <div className="ui-disclosure__body form-stack">
                <FormField label="Tiêu đề">
                  <input value={gapForm.title} onChange={(e) => setGapForm({ ...gapForm, title: e.target.value })} />
                </FormField>
                <FormField label="Mô tả">
                  <textarea rows={2} value={gapForm.description} onChange={(e) => setGapForm({ ...gapForm, description: e.target.value })} />
                </FormField>
                <div className="field-row">
                  <FormField label="Mức độ nghiêm trọng">
                    <select value={gapForm.severity} onChange={(e) => setGapForm({ ...gapForm, severity: e.target.value })}>
                      {GAP_SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {GAP_SEVERITY_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Đánh giá nguồn" optional hint="Chọn nếu gap phát sinh từ 1 đợt đánh giá">
                    <select value={gapForm.sourceAssessmentId} onChange={(e) => setGapForm({ ...gapForm, sourceAssessmentId: e.target.value })}>
                      <option value="">— Không chọn —</option>
                      {assessments.map((a) => (
                        <option key={a.id} value={a.id}>
                          Đánh giá {a.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <FormField label="Evidence ID" optional hint="Bắt buộc nếu không chọn đánh giá nguồn — UUID, phân tách bằng dấu phẩy">
                  <input value={gapForm.evidenceIds} onChange={(e) => setGapForm({ ...gapForm, evidenceIds: e.target.value })} />
                </FormField>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busyKey === "create-gap" || !gapForm.title || !gapForm.description}
                  onClick={onCreateGap}
                  style={{ alignSelf: "flex-start" }}
                >
                  {busyKey === "create-gap" ? "Đang tạo…" : "Ghi nhận gap"}
                </Button>
              </div>
            </details>
          </CardBody>
        </Card>

        {/* ---------- roadmap — mini timeline ---------- */}
        <Card>
          <CardHeader
            title={`Roadmap (${roadmaps.length})`}
            action={latestRoadmap && <ButtonLink href={`/roadmaps/${latestRoadmap.id}`} variant="secondary" size="sm">Xem chi tiết →</ButtonLink>}
          />
          <CardBody>
            {roadmaps.length === 0 ? (
              <EmptyState message="Chưa có roadmap nào. Tạo roadmap để lập kế hoạch thương mại hoá." />
            ) : (
              <>
                {milestones.length > 0 && (
                  <Timeline steps={milestones.map((m) => ({ id: m.id, label: m.title, status: m.status }))} />
                )}
                <Table columns={["Roadmap", "Trạng thái"]}>
                  {roadmaps.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <TextLink href={`/roadmaps/${r.id}`}>
                          {r.title} · v{r.versionNo}
                        </TextLink>
                      </td>
                      <td>
                        <StatusBadge tone={roadmapStatusTone(r.status)} label={ROADMAP_STATUS_LABELS[r.status] ?? r.status} />
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            )}

            <details className="ui-disclosure" style={{ marginTop: "var(--space-5)" }}>
              <summary>Tạo phiên bản roadmap mới</summary>
              <div className="ui-disclosure__body">
                <FormField label="Tiêu đề roadmap">
                  <input value={roadmapTitle} onChange={(e) => setRoadmapTitle(e.target.value)} />
                </FormField>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busyKey === "create-roadmap" || !roadmapTitle}
                  onClick={onCreateRoadmap}
                  className="ui-mt-4"
                >
                  {busyKey === "create-roadmap" ? "Đang tạo…" : "Tạo roadmap"}
                </Button>
              </div>
            </details>
          </CardBody>
        </Card>

        {/* ---------- quản trị (nâng cao, thu gọn — hầu hết chuyển trạng thái diễn ra tự động) ---------- */}
        <details className="ui-disclosure" style={{ marginTop: "var(--space-6)" }}>
          <summary>Quản trị case (nâng cao)</summary>
          <div className="ui-disclosure__body">
            <Card>
              <CardHeader title="Chuyển trạng thái thủ công" />
              <CardBody>
                <p style={{ fontSize: 13, color: "var(--ink-400)" }}>
                  Hầu hết trạng thái case tự chuyển khi có evidence/đánh giá/gap/roadmap mới. Chỉ dùng mục này khi thật
                  sự cần can thiệp thủ công.
                </p>
                <div className="field-row" style={{ marginTop: "var(--space-4)" }}>
                  <FormField label="Trạng thái đích">
                    <select value={transitionStatus} onChange={(e) => setTransitionStatus(e.target.value)}>
                      {TECHNOLOGY_CASE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TECHNOLOGY_CASE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Lý do" optional>
                    <input value={transitionReason} onChange={(e) => setTransitionReason(e.target.value)} />
                  </FormField>
                </div>
                <Button variant="secondary" size="sm" disabled={busyKey === "transition"} onClick={onTransition} className="ui-mt-4">
                  {busyKey === "transition" ? "Đang chuyển…" : "Chuyển trạng thái"}
                </Button>
              </CardBody>
            </Card>
          </div>
        </details>
      </div>
    </div>
  );
}
