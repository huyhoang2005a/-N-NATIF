"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Ban, Flag, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import type {
  AnnotationResponse,
  ContentFlagResponse,
  MeResponse,
  OrganizationResponse,
  ResourceAccessGrantResponse,
  ResourceResponse,
  ResourceUploadResponse,
  ResourceVersionResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { CONTENT_FLAG_REASON_OPTIONS, PLATFORM_ROLE_LABELS, RESOURCE_ACCESS_LEVEL_LABELS, RESOURCE_TYPE_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { fetchUserNames } from "../../../lib/user-lookup";
import { BackLink, Card, GhostButton, PageLoader, PrimaryButton, SaveButton, SectionHeader, SelectField, Shell, StatusPill, TextField, VoteButton } from "../../../components/ui";

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
  const [grants, setGrants] = useState<ResourceAccessGrantResponse[] | null>(null);
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
    const [meResponse, myOrgs, r, grantRows] = await Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ResourceResponse>(`/resources/${resourceId}`),
      authFetch<ResourceAccessGrantResponse[]>(`/resources/${resourceId}/access-grants`),
    ]);
    setMe(meResponse);
    setOrganizations(myOrgs);
    setResource(r);
    setGrants(grantRows);
    fetchUserNames(grantRows.filter((g) => g.recipientUserId).map((g) => g.recipientUserId!)).then(setGrantUserNames);
    await loadVersionsAndAnnotations();
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

  if (!resource || !grants) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        <PageLoader inline />
      </Shell>
    );
  }

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
              {versions.map((v) => (
                <div key={v.id} className="uikit-row">
                  <span style={{ fontSize: 14 }}>v{v.versionNo}{v.versionLabel ? ` · ${v.versionLabel}` : ""}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <StatusPill tone={v.status === "PUBLISHED" ? "green" : "gray"}>{v.status}</StatusPill>
                    {v.status === "DRAFT" && (
                      <GhostButton icon={UploadCloud} disabled={busyKey === `publish-${v.id}`} onClick={() => onPublishVersion(v.id)}>
                        {busyKey === `publish-${v.id}` ? "Đang xuất bản…" : "Xuất bản"}
                      </GhostButton>
                    )}
                  </div>
                </div>
              ))}
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
      </div>
    </Shell>
  );
}
