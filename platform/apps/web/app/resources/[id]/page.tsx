"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Ban, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import type {
  AnnotationResponse,
  MeResponse,
  OrganizationResponse,
  ResourceAccessGrantResponse,
  ResourceResponse,
  ResourceUploadResponse,
  ResourceVersionResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS, RESOURCE_ACCESS_LEVEL_LABELS, RESOURCE_TYPE_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { BackLink, Card, GhostButton, PrimaryButton, SaveButton, SectionHeader, SelectField, Shell, StatusPill, TextField, VoteButton } from "../../../components/ui";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Không có endpoint liệt kê version/annotation đã có — chỉ giữ lại những gì
  // được tạo trong phiên làm việc hiện tại (ephemeral), không phải danh sách
  // đầy đủ. Ghi rõ giới hạn này trong giao diện, không giả vờ đây là danh sách đủ.
  const [sessionVersions, setSessionVersions] = useState<ResourceVersionResponse[]>([]);
  const [sessionAnnotations, setSessionAnnotations] = useState<AnnotationResponse[]>([]);

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
      const version = await authFetch<ResourceVersionResponse>(`/resources/${resourceId}/versions`, {
        method: "POST",
        body: JSON.stringify({ versionLabel: versionLabel || undefined, storageObjectKey: upload.storageObjectKey }),
      });
      setSessionVersions((prev) => [version, ...prev]);
      setVersionLabel("");
      setVersionFile(null);
    });
  }

  function onPublishVersion(versionId: string) {
    return runAction(`publish-${versionId}`, async () => {
      const published = await authFetch<ResourceVersionResponse>(`/resource-versions/${versionId}/publish`, { method: "POST" });
      setSessionVersions((prev) => prev.map((v) => (v.id === versionId ? published : v)));
    });
  }

  // ---------- annotations ----------
  const [annotationForm, setAnnotationForm] = useState({ resourceVersionId: "", targetSnippet: "", content: "" });

  function onAddAnnotation() {
    return runAction("add-annotation", async () => {
      const annotation = await authFetch<AnnotationResponse>(`/resource-versions/${annotationForm.resourceVersionId}/annotations`, {
        method: "POST",
        body: JSON.stringify({ targetSnippet: annotationForm.targetSnippet, content: annotationForm.content }),
      });
      setSessionAnnotations((prev) => [annotation, ...prev]);
      setAnnotationForm({ resourceVersionId: annotationForm.resourceVersionId, targetSnippet: "", content: "" });
    });
  }

  function onRemoveAnnotation(annotationId: string) {
    return runAction(`remove-annotation-${annotationId}`, async () => {
      await authFetch(`/annotations/${annotationId}`, { method: "DELETE" });
      setSessionAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
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

  if (!resource || !grants) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        {null}
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
          </div>
        </div>
        {resource.description && <p style={{ fontSize: 14, color: "var(--uikit-slate-700)" }}>{resource.description}</p>}

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        <Card>
          <SectionHeader title="Phiên bản" />
          <p style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>
            Chưa có API liệt kê toàn bộ phiên bản — chỉ hiện phiên bản bạn vừa tạo trong phiên
            làm việc này.
          </p>
          {sessionVersions.length > 0 && (
            <div className="uikit-row-list" style={{ marginTop: "var(--space-3)" }}>
              {sessionVersions.map((v) => (
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
          <SectionHeader title="Chú giải (annotation)" />
          <p style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>
            Chưa có API liệt kê toàn bộ chú giải — chỉ hiện chú giải bạn vừa tạo trong phiên làm
            việc này.
          </p>
          {sessionAnnotations.length > 0 && (
            <div className="uikit-row-list" style={{ marginTop: "var(--space-3)" }}>
              {sessionAnnotations.map((a) => (
                <div key={a.id} className="uikit-row">
                  <span style={{ fontSize: 14 }}>{a.content}</span>
                  <GhostButton tone="red" icon={Trash2} disabled={busyKey === `remove-annotation-${a.id}`} onClick={() => onRemoveAnnotation(a.id)}>
                    Xoá
                  </GhostButton>
                </div>
              ))}
            </div>
          )}
          <div className="uikit-stack" style={{ marginTop: "var(--space-4)" }}>
            <TextField
              label="Resource Version ID"
              hint="Dán UUID phiên bản vừa tạo ở trên, hoặc phiên bản đã có sẵn."
              value={annotationForm.resourceVersionId}
              onChange={(e) => setAnnotationForm({ ...annotationForm, resourceVersionId: e.target.value })}
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
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                    {g.recipientUserId ? `User ${g.recipientUserId.slice(0, 8)}` : `Tổ chức ${g.recipientOrganizationId?.slice(0, 8)}`} · {g.permission}
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
