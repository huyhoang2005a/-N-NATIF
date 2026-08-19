"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Ban, Download, Eye, FilePlus2, Flag, Handshake, Plus, Save, Sparkles, Trash2, UploadCloud } from "lucide-react";
import type {
  AnnotationResponse,
  CaseInitiationRequestResponse,
  ContentFlagResponse,
  MeResponse,
  OrganizationResponse,
  ResourceAccessGrantResponse,
  ResourceResponse,
  ResourceUploadResponse,
  ResourceVersionContentUrlResponse,
  ResourceVersionResponse,
  ResourceVersionSummaryResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { CONTENT_FLAG_REASON_OPTIONS, PLATFORM_ROLE_LABELS, RESOURCE_ACCESS_LEVEL_LABELS, RESOURCE_TYPE_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { fetchUserNames } from "../../../lib/user-lookup";
import { BackLink, Card, GhostButton, PageLoader, PrimaryButton, SaveButton, SectionHeader, SelectField, Shell, StatusPill, TextField, VoteButton } from "../../../components/ui";

type SummaryState =
  | { status: "loading" }
  | { status: "loaded"; text: string }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "error" };

const PERMISSION_OPTIONS = [
  { value: "VIEW", label: "Xem" },
  { value: "DOWNLOAD", label: "Tải xuống" },
  { value: "MANAGE", label: "Quản lý" },
];

export default function ResourceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const resourceId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [resource, setResource] = useState<ResourceResponse | null>(null);
  const [grants, setGrants] = useState<ResourceAccessGrantResponse[]>([]);
  // `GET /resources/:id/access-grants` is manager-only (ORG_OWNER/ORG_ADMIN of the
  // resource's owning org) — most viewers 403 on it (correctly: who's been granted access
  // is administrative info, not something every viewer should see). It used to sit in the
  // same `Promise.all` as the resource itself, so that 403 broke the ENTIRE page for any
  // non-manager viewer, not just the grants section. Fetched separately below instead, and
  // this flag gates whether the "Quyền truy cập" card renders at all.
  const [canManageGrants, setCanManageGrants] = useState(false);
  const [grantUserNames, setGrantUserNames] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [versions, setVersions] = useState<ResourceVersionResponse[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationResponse[]>([]);

  async function loadVersionsAndAnnotations() {
    const versionRows = await authFetch<ResourceVersionResponse[]>(`/resources/${resourceId}/versions`);
    setVersions(versionRows);
    const annotationLists = await Promise.all(
      versionRows.map((v) => authFetch<AnnotationResponse[]>(`/resource-versions/${v.id}/annotations`)),
    );
    setAnnotations(annotationLists.flat());
  }

  async function load() {
    const [meResponse, myOrgs, r] = await Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ResourceResponse>(`/resources/${resourceId}`),
    ]);
    setMe(meResponse);
    setOrganizations(myOrgs);
    setResource(r);
    await loadVersionsAndAnnotations();

    try {
      const grantRows = await authFetch<ResourceAccessGrantResponse[]>(`/resources/${resourceId}/access-grants`);
      setGrants(grantRows);
      setCanManageGrants(true);
      fetchUserNames(grantRows.filter((g) => g.recipientUserId).map((g) => g.recipientUserId!)).then(setGrantUserNames);
    } catch (err) {
      if (err instanceof SessionExpiredError) throw err;
      // Not a manager of the owning org — expected for most viewers, not a real error.
      setGrants([]);
      setCanManageGrants(false);
    }
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
      setLoadError("Không tải được dữ liệu tài nguyên.");
    });
    // Intentionally depends only on resourceId — `load` closes over state that would
    // otherwise cause a dependency-array footgun; router doesn't change across renders.
  }, [resourceId]);

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

  // ---------- versions ----------
  const [versionLabel, setVersionLabel] = useState("");
  const [versionFile, setVersionFile] = useState<File | null>(null);

  function onAddVersion() {
    if (!versionFile) return Promise.resolve();
    return runAction("add-version", async () => {
      const upload = await authFetch<ResourceUploadResponse>("/resources/uploads", {
        method: "POST",
        body: JSON.stringify({ originalFilename: versionFile.name, mimeType: versionFile.type, sizeBytes: versionFile.size }),
      });
      const putResponse = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": versionFile.type }, body: versionFile });
      if (!putResponse.ok) throw new Error("upload failed");
      await authFetch<ResourceVersionResponse>(`/resources/${resourceId}/versions`, {
        method: "POST",
        body: JSON.stringify({ versionLabel: versionLabel || undefined, storageObjectKey: upload.storageObjectKey }),
      });
      setVersionLabel("");
      setVersionFile(null);
      await loadVersionsAndAnnotations();
    });
  }

  function onPublishVersion(versionId: string) {
    return runAction(`publish-${versionId}`, async () => {
      await authFetch<ResourceVersionResponse>(`/resource-versions/${versionId}/publish`, { method: "POST" });
      await loadVersionsAndAnnotations();
    });
  }

  // ---------- view / download file content ----------
  function onViewVersion(versionId: string) {
    return runAction(`view-${versionId}`, async () => {
      const res = await authFetch<ResourceVersionContentUrlResponse>(
        `/resources/${resourceId}/versions/${versionId}/content-url`,
      );
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  function onDownloadVersion(versionId: string) {
    return runAction(`download-${versionId}`, async () => {
      const res = await authFetch<ResourceVersionContentUrlResponse>(
        `/resources/${resourceId}/versions/${versionId}/content-url?download=true`,
      );
      const link = document.createElement("a");
      link.href = res.url;
      link.rel = "noopener";
      link.click();
    });
  }

  // ---------- AI summary ----------
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});

  function onSummarizeVersion(versionId: string) {
    setSummaries((prev) => ({ ...prev, [versionId]: { status: "loading" } }));
    authFetch<ResourceVersionSummaryResponse>(`/resources/${resourceId}/versions/${versionId}/summarize`, {
      method: "POST",
    })
      .then((res) => {
        setSummaries((prev) => ({
          ...prev,
          [versionId]: res.summary ? { status: "loaded", text: res.summary } : { status: "empty" },
        }));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        if (err instanceof ApiError && err.code === "ASSISTANT_UNAVAILABLE") {
          setSummaries((prev) => ({ ...prev, [versionId]: { status: "unavailable" } }));
          return;
        }
        setSummaries((prev) => ({ ...prev, [versionId]: { status: "error" } }));
      });
  }

  // ---------- annotations ----------
  const [annotationForm, setAnnotationForm] = useState({ resourceVersionId: "", targetSnippet: "", content: "" });

  function onAddAnnotation() {
    return runAction("add-annotation", async () => {
      await authFetch<AnnotationResponse>(`/resource-versions/${annotationForm.resourceVersionId}/annotations`, {
        method: "POST",
        body: JSON.stringify({ targetSnippet: annotationForm.targetSnippet, content: annotationForm.content }),
      });
      setAnnotationForm({ resourceVersionId: annotationForm.resourceVersionId, targetSnippet: "", content: "" });
      await loadVersionsAndAnnotations();
    });
  }

  function onRemoveAnnotation(annotationId: string) {
    return runAction(`remove-annotation-${annotationId}`, async () => {
      await authFetch(`/annotations/${annotationId}`, { method: "DELETE" });
      await loadVersionsAndAnnotations();
    });
  }

  // ---------- access grants ----------
  const [grantForm, setGrantForm] = useState({ recipientType: "user" as "user" | "organization", recipientId: "", permission: "VIEW" });

  function onGrantAccess() {
    return runAction("grant-access", async () => {
      await authFetch(`/resources/${resourceId}/access-requests`, {
        method: "POST",
        body: JSON.stringify({
          recipientUserId: grantForm.recipientType === "user" ? grantForm.recipientId : undefined,
          recipientOrganizationId: grantForm.recipientType === "organization" ? grantForm.recipientId : undefined,
          permission: grantForm.permission,
        }),
      });
      setGrantForm({ recipientType: "user", recipientId: "", permission: "VIEW" });
      const grantRows = await authFetch<ResourceAccessGrantResponse[]>(`/resources/${resourceId}/access-grants`);
      setGrants(grantRows);
    });
  }

  function onRevokeGrant(grantId: string) {
    return runAction(`revoke-${grantId}`, async () => {
      await authFetch(`/access-grants/${grantId}/revoke`, { method: "POST" });
      const grantRows = await authFetch<ResourceAccessGrantResponse[]>(`/resources/${resourceId}/access-grants`);
      setGrants(grantRows);
    });
  }

  // ---------- content flag (Sprint 6.3) ----------
  const [flaggingTarget, setFlaggingTarget] = useState<{ type: "RESOURCE" | "ANNOTATION"; id: string } | null>(null);
  const [flagForm, setFlagForm] = useState({ reasonCode: CONTENT_FLAG_REASON_OPTIONS[0].value, details: "" });
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  function onSubmitFlag() {
    if (!flaggingTarget || !flagForm.details.trim()) return Promise.resolve();
    const target = flaggingTarget;
    return runAction(`flag-${target.id}`, async () => {
      await authFetch<ContentFlagResponse>("/content-flags", {
        method: "POST",
        body: JSON.stringify({ targetType: target.type, targetId: target.id, reasonCode: flagForm.reasonCode, details: flagForm.details.trim() }),
      });
      setFlaggedIds((prev) => new Set(prev).add(target.id));
      setFlaggingTarget(null);
      setFlagForm({ reasonCode: CONTENT_FLAG_REASON_OPTIONS[0].value, details: "" });
    });
  }

  // ---------- company: request case initiation directly from this document (2026-08-19) ----------
  const [caseInitiationFormOpen, setCaseInitiationFormOpen] = useState(false);
  const [caseInitiationOrgId, setCaseInitiationOrgId] = useState("");
  const [caseInitiationMessage, setCaseInitiationMessage] = useState("");
  const [caseInitiationSent, setCaseInitiationSent] = useState(false);

  const publishedVersion = versions.find((v) => v.status === "PUBLISHED") ?? null;

  function onSendCaseInitiationRequest() {
    if (!publishedVersion || !caseInitiationOrgId) return Promise.resolve();
    return runAction("send-case-initiation-request", async () => {
      await authFetch<CaseInitiationRequestResponse>(
        `/resources/${resourceId}/versions/${publishedVersion.id}/case-initiation-requests`,
        {
          method: "POST",
          body: JSON.stringify({ requestingOrganizationId: caseInitiationOrgId, message: caseInitiationMessage.trim() || undefined }),
        },
      );
      setCaseInitiationSent(true);
      setCaseInitiationFormOpen(false);
    });
  }

  if (!me || !organizations) {
    if (loadError) {
      return (
        <div className="uikit-main" style={{ maxWidth: 720, margin: "0 auto" }}>
          <p className="uikit-alert-error" role="alert">
            {loadError}
          </p>
        </div>
      );
    }
    return <PageLoader />;
  }

  const roleLabel = PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole;
  const persona = personaOf(me, organizations);
  const nav = navForPersona(persona, me.platformRole === "PLATFORM_ADMIN");

  if (loadError) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        <p className="uikit-alert-error" role="alert">
          {loadError}
        </p>
      </Shell>
    );
  }

  if (!resource) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        <PageLoader inline />
      </Shell>
    );
  }

  // Company viewer, browsing a document NOT owned by any of their own organizations — the
  // "gửi yêu cầu tạo case từ tài liệu này" flow. Independent of the author-side "Tạo case
  // công nghệ từ tài liệu này" button above (gated the opposite way, on
  // `authorVerificationStatus`) — the two are never meant to show to the same viewer, but
  // each is gated on its own condition regardless, not on the other being hidden.
  const ownsResource = organizations.some((org) => org.id === resource.ownerOrganizationId);
  const canRequestCaseInitiation = persona === "company" && !ownsResource && publishedVersion !== null;

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
      <div className="uikit-stack" style={{ maxWidth: 720 }}>
        <BackLink href="/resources">Quay lại danh sách tài nguyên</BackLink>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <div>
            <h1 style={{ fontSize: 22 }}>{resource.title}</h1>
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>
              {RESOURCE_TYPE_LABELS[resource.type] ?? resource.type} · {RESOURCE_ACCESS_LEVEL_LABELS[resource.accessLevel] ?? resource.accessLevel}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <VoteButton
              path={`/resources/${resourceId}/votes`}
              votedByMe={resource.votedByMe}
              voteCount={resource.voteCount}
              onChange={(next) => setResource((prev) => (prev ? { ...prev, ...next } : prev))}
              onSessionExpired={() => router.push("/login")}
            />
            <SaveButton
              path={`/resources/${resourceId}/saves`}
              savedByMe={resource.savedByMe}
              onChange={(next) => setResource((prev) => (prev ? { ...prev, ...next } : prev))}
              onSessionExpired={() => router.push("/login")}
            />
            <StatusPill tone={resource.status === "ACTIVE" ? "green" : "gray"}>{resource.status}</StatusPill>
            {me.authorVerificationStatus === "VERIFIED" && (
              <GhostButton icon={FilePlus2} onClick={() => router.push(`/technology-cases/new?fromResourceId=${resourceId}`)}>
                Tạo case công nghệ từ tài liệu này
              </GhostButton>
            )}
            {canRequestCaseInitiation && (
              caseInitiationSent ? (
                <span style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>Đã gửi yêu cầu, chờ tác giả phản hồi.</span>
              ) : (
                <GhostButton
                  icon={Handshake}
                  onClick={() => {
                    setCaseInitiationOrgId(organizations.length === 1 ? organizations[0].id : "");
                    setCaseInitiationMessage("");
                    setCaseInitiationFormOpen(true);
                  }}
                >
                  Gửi yêu cầu tạo lộ trình sử dụng tài liệu này
                </GhostButton>
              )
            )}
            {flaggedIds.has(resourceId) ? (
              <span style={{ fontSize: 13, color: "var(--uikit-slate-400)" }}>Đã báo cáo</span>
            ) : (
              <GhostButton
                tone="red"
                icon={Flag}
                onClick={() => {
                  setFlaggingTarget({ type: "RESOURCE", id: resourceId });
                  setFlagForm({ reasonCode: CONTENT_FLAG_REASON_OPTIONS[0].value, details: "" });
                }}
              >
                Báo cáo nội dung
              </GhostButton>
            )}
          </div>
        </div>
        {resource.description && <p style={{ fontSize: 14, color: "var(--uikit-slate-700)" }}>{resource.description}</p>}

        {caseInitiationFormOpen && (
          <Card>
            <SectionHeader title="Gửi yêu cầu tạo lộ trình sử dụng tài liệu này" />
            <p style={{ fontSize: 13, color: "var(--uikit-slate-500)", marginTop: "var(--space-2)" }}>
              Tác giả sẽ nhận được yêu cầu này và có thể chấp nhận để tự động tạo một Technology Case, với tổ chức của bạn
              được thêm vào với vai trò đối tác (PARTNER_COMPANY).
            </p>
            <div className="uikit-stack" style={{ marginTop: "var(--space-3)" }}>
              {organizations.length > 1 && (
                <SelectField
                  label="Tổ chức của bạn gửi yêu cầu"
                  value={caseInitiationOrgId}
                  onChange={(e) => setCaseInitiationOrgId(e.target.value)}
                  options={[
                    { value: "", label: "— Chọn tổ chức —" },
                    ...organizations.map((org) => ({ value: org.id, label: org.name })),
                  ]}
                />
              )}
              <TextField
                label="Lời nhắn"
                as="textarea"
                optional
                value={caseInitiationMessage}
                onChange={(e) => setCaseInitiationMessage(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <PrimaryButton
                disabled={busyKey === "send-case-initiation-request" || !caseInitiationOrgId}
                onClick={onSendCaseInitiationRequest}
              >
                {busyKey === "send-case-initiation-request" ? "Đang gửi…" : "Gửi yêu cầu"}
              </PrimaryButton>
              <GhostButton disabled={busyKey === "send-case-initiation-request"} onClick={() => setCaseInitiationFormOpen(false)}>
                Huỷ
              </GhostButton>
            </div>
          </Card>
        )}

        {flaggingTarget?.type === "RESOURCE" && flaggingTarget.id === resourceId && (
          <Card>
            <SectionHeader title="Báo cáo nội dung vi phạm" />
            <div className="uikit-stack" style={{ marginTop: "var(--space-3)" }}>
              <SelectField
                label="Lý do"
                value={flagForm.reasonCode}
                onChange={(e) => setFlagForm({ ...flagForm, reasonCode: e.target.value })}
                options={CONTENT_FLAG_REASON_OPTIONS}
              />
              <TextField
                label="Mô tả chi tiết"
                as="textarea"
                required
                value={flagForm.details}
                onChange={(e) => setFlagForm({ ...flagForm, details: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <PrimaryButton disabled={busyKey === `flag-${resourceId}` || !flagForm.details.trim()} onClick={onSubmitFlag}>
                {busyKey === `flag-${resourceId}` ? "Đang gửi…" : "Gửi báo cáo"}
              </PrimaryButton>
              <GhostButton disabled={busyKey === `flag-${resourceId}`} onClick={() => setFlaggingTarget(null)}>
                Huỷ
              </GhostButton>
            </div>
          </Card>
        )}

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        <Card>
          <SectionHeader title={`Phiên bản (${versions.length})`} />
          {versions.length === 0 ? (
            <p className="uikit-empty">Chưa có phiên bản nào.</p>
          ) : (
            <div className="uikit-row-list" style={{ marginTop: "var(--space-3)" }}>
              {versions.map((v) => {
                const summary = summaries[v.id];
                return (
                  <div key={v.id}>
                    <div className="uikit-row">
                      <span style={{ fontSize: 14 }}>v{v.versionNo}{v.versionLabel ? ` · ${v.versionLabel}` : ""}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                        <StatusPill tone={v.status === "PUBLISHED" ? "green" : "gray"}>{v.status}</StatusPill>
                        {v.status === "DRAFT" && (
                          <GhostButton icon={UploadCloud} disabled={busyKey === `publish-${v.id}`} onClick={() => onPublishVersion(v.id)}>
                            {busyKey === `publish-${v.id}` ? "Đang xuất bản…" : "Xuất bản"}
                          </GhostButton>
                        )}
                        {v.storageObjectKey && (
                          <>
                            <GhostButton icon={Eye} disabled={busyKey === `view-${v.id}`} onClick={() => onViewVersion(v.id)}>
                              {busyKey === `view-${v.id}` ? "Đang mở…" : "Xem file"}
                            </GhostButton>
                            <GhostButton icon={Download} disabled={busyKey === `download-${v.id}`} onClick={() => onDownloadVersion(v.id)}>
                              {busyKey === `download-${v.id}` ? "Đang tải…" : "Tải xuống"}
                            </GhostButton>
                          </>
                        )}
                        {(!summary || summary.status === "error") && (
                          <GhostButton icon={Sparkles} onClick={() => onSummarizeVersion(v.id)}>
                            {summary?.status === "error" ? "Thử lại tóm tắt AI" : "Tóm tắt AI"}
                          </GhostButton>
                        )}
                      </div>
                    </div>
                    {summary && (
                      <div style={{ marginTop: "var(--space-2)", padding: "var(--space-3)", background: "var(--uikit-slate-50)", borderRadius: "var(--radius-sm)" }}>
                        {summary.status === "loading" && <p className="uikit-empty">Đang tóm tắt bằng AI…</p>}
                        {summary.status === "loaded" && <p style={{ fontSize: 13, color: "var(--uikit-slate-700)" }}>{summary.text}</p>}
                        {summary.status === "empty" && <p className="uikit-empty">Chưa có nội dung để tóm tắt.</p>}
                        {summary.status === "unavailable" && <p className="uikit-empty">Trợ lý AI chưa sẵn sàng.</p>}
                        {summary.status === "error" && <p className="uikit-empty">Tóm tắt thất bại, vui lòng thử lại.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
            <TextField label="Nhãn phiên bản" optional value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} />
            <label className="uikit-field">
              <span className="uikit-field__label">Tệp tài liệu</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <PrimaryButton icon={Plus} disabled={busyKey === "add-version" || !versionFile} onClick={onAddVersion} className="uikit-mt-4">
            {busyKey === "add-version" ? "Đang tải lên…" : "Thêm phiên bản"}
          </PrimaryButton>
        </Card>

        <Card>
          <SectionHeader title={`Chú giải (annotation) (${annotations.length})`} />
          {annotations.length === 0 ? (
            <p className="uikit-empty">Chưa có chú giải nào.</p>
          ) : (
            <div className="uikit-row-list" style={{ marginTop: "var(--space-3)" }}>
              {annotations.map((a) => (
                <div key={a.id}>
                  <div className="uikit-row">
                    <span style={{ fontSize: 14 }}>{a.content}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      {flaggedIds.has(a.id) ? (
                        <span style={{ fontSize: 13, color: "var(--uikit-slate-400)" }}>Đã báo cáo</span>
                      ) : (
                        <GhostButton
                          tone="red"
                          icon={Flag}
                          onClick={() => {
                            setFlaggingTarget({ type: "ANNOTATION", id: a.id });
                            setFlagForm({ reasonCode: CONTENT_FLAG_REASON_OPTIONS[0].value, details: "" });
                          }}
                        >
                          Báo cáo
                        </GhostButton>
                      )}
                      <GhostButton tone="red" icon={Trash2} disabled={busyKey === `remove-annotation-${a.id}`} onClick={() => onRemoveAnnotation(a.id)}>
                        Xoá
                      </GhostButton>
                    </div>
                  </div>
                  {flaggingTarget?.type === "ANNOTATION" && flaggingTarget.id === a.id && (
                    <div style={{ padding: "var(--space-4)", border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", marginTop: "var(--space-2)" }}>
                      <div className="uikit-stack">
                        <SelectField
                          label="Lý do"
                          value={flagForm.reasonCode}
                          onChange={(e) => setFlagForm({ ...flagForm, reasonCode: e.target.value })}
                          options={CONTENT_FLAG_REASON_OPTIONS}
                        />
                        <TextField
                          label="Mô tả chi tiết"
                          as="textarea"
                          required
                          value={flagForm.details}
                          onChange={(e) => setFlagForm({ ...flagForm, details: e.target.value })}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
                        <PrimaryButton disabled={busyKey === `flag-${a.id}` || !flagForm.details.trim()} onClick={onSubmitFlag}>
                          {busyKey === `flag-${a.id}` ? "Đang gửi…" : "Gửi báo cáo"}
                        </PrimaryButton>
                        <GhostButton disabled={busyKey === `flag-${a.id}`} onClick={() => setFlaggingTarget(null)}>
                          Huỷ
                        </GhostButton>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
            <SelectField
              label="Phiên bản"
              value={annotationForm.resourceVersionId}
              onChange={(e) => setAnnotationForm({ ...annotationForm, resourceVersionId: e.target.value })}
              options={[
                { value: "", label: "— Chọn phiên bản —" },
                ...versions.map((v) => ({ value: v.id, label: `v${v.versionNo}${v.versionLabel ? ` · ${v.versionLabel}` : ""}` })),
              ]}
            />
            <TextField
              label="Đoạn trích (target snippet)"
              value={annotationForm.targetSnippet}
              onChange={(e) => setAnnotationForm({ ...annotationForm, targetSnippet: e.target.value })}
            />
            <TextField
              label="Nội dung chú giải"
              as="textarea"
              value={annotationForm.content}
              onChange={(e) => setAnnotationForm({ ...annotationForm, content: e.target.value })}
            />
          </div>
          <PrimaryButton
            icon={Save}
            disabled={busyKey === "add-annotation" || !annotationForm.resourceVersionId || !annotationForm.targetSnippet || !annotationForm.content}
            onClick={onAddAnnotation}
            className="uikit-mt-4"
          >
            {busyKey === "add-annotation" ? "Đang thêm…" : "Thêm chú giải"}
          </PrimaryButton>
        </Card>

        {canManageGrants && (
        <Card>
          <SectionHeader title={`Quyền truy cập (${grants.length})`} />
          {grants.length === 0 ? (
            <p className="uikit-empty">Chưa cấp quyền cho ai ngoài chủ sở hữu.</p>
          ) : (
            <div className="uikit-row-list">
              {grants.map((g) => (
                <div key={g.id} className="uikit-row">
                  <span style={{ fontSize: 13 }}>
                    {g.recipientUserId ? (
                      grantUserNames[g.recipientUserId] ?? (
                        <span style={{ fontFamily: "var(--font-mono)" }}>User {g.recipientUserId.slice(0, 8)}</span>
                      )
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono)" }}>Tổ chức {g.recipientOrganizationId?.slice(0, 8)}</span>
                    )}{" "}
                    · {g.permission}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <StatusPill tone={g.status === "ACTIVE" ? "green" : "gray"}>{g.status}</StatusPill>
                    {g.status === "ACTIVE" && (
                      <GhostButton tone="red" icon={Ban} disabled={busyKey === `revoke-${g.id}`} onClick={() => onRevokeGrant(g.id)}>
                        Thu hồi
                      </GhostButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
            <SelectField
              label="Cấp cho"
              value={grantForm.recipientType}
              onChange={(e) => setGrantForm({ ...grantForm, recipientType: e.target.value as "user" | "organization" })}
              options={[{ value: "user", label: "Người dùng (UUID)" }, { value: "organization", label: "Tổ chức (UUID)" }]}
            />
            <TextField
              label={grantForm.recipientType === "user" ? "User ID" : "Organization ID"}
              value={grantForm.recipientId}
              onChange={(e) => setGrantForm({ ...grantForm, recipientId: e.target.value })}
            />
            <SelectField
              label="Quyền"
              value={grantForm.permission}
              onChange={(e) => setGrantForm({ ...grantForm, permission: e.target.value })}
              options={PERMISSION_OPTIONS}
            />
          </div>
          <PrimaryButton icon={Plus} disabled={busyKey === "grant-access" || !grantForm.recipientId} onClick={onGrantAccess} className="uikit-mt-4">
            {busyKey === "grant-access" ? "Đang cấp quyền…" : "Cấp quyền"}
          </PrimaryButton>
        </Card>
        )}
      </div>
    </Shell>
  );
}
