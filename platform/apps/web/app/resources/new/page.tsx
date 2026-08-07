"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  MeResponse,
  OrganizationResponse,
  RegisterResourceRequest,
  ResourceResponse,
  ResourceUploadResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS, RESOURCE_ACCESS_LEVEL_LABELS, RESOURCE_TYPE_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { BackLink, PrimaryButton, SelectField, Shell, TextField } from "../../../components/ui";

export default function ResourceNewPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({
    ownerOrganizationId: "",
    title: "",
    type: "PAPER" as RegisterResourceRequest["type"],
    accessLevel: "PUBLIC" as RegisterResourceRequest["accessLevel"],
    description: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([authFetch<MeResponse>("/me"), authFetch<OrganizationResponse[]>("/organizations")])
      .then(([meResponse, orgs]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        if (orgs.length > 0) setForm((f) => ({ ...f, ownerOrganizationId: orgs[0]?.id ?? "" }));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setLoadError("Không tải được danh sách tổ chức.");
      });
  }, [router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setStatus("error");
      setErrorMessage("Vui lòng chọn tệp tài liệu.");
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
    try {
      const upload = await authFetch<ResourceUploadResponse>("/resources/uploads", {
        method: "POST",
        body: JSON.stringify({ originalFilename: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const putResponse = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error("upload failed");
      }
      const created = await authFetch<ResourceResponse>("/resources", {
        method: "POST",
        body: JSON.stringify({
          ownerOrganizationId: form.ownerOrganizationId,
          type: form.type,
          title: form.title,
          description: form.description || undefined,
          accessLevel: form.accessLevel,
          storageObjectKey: upload.storageObjectKey,
        } satisfies RegisterResourceRequest),
      });
      router.push(`/resources`);
      void created;
    } catch (err) {
      setStatus("error");
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setErrorMessage(err instanceof ApiError ? describeErrorCode(err.code) : "Đăng tài nguyên thất bại, vui lòng thử lại.");
    }
  }

  if (!me || !organizations) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  if (loadError) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
        <p className="uikit-alert-error" role="alert">
          {loadError}
        </p>
      </Shell>
    );
  }

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div style={{ maxWidth: 480 }}>
      <BackLink href="/resources">Quay lại danh sách tài nguyên</BackLink>
      <h1 style={{ fontSize: 22, marginBottom: "var(--space-5)" }}>Đăng tài nguyên mới</h1>

      {organizations.length === 0 ? (
        <p className="uikit-empty">Bạn cần là thành viên của ít nhất 1 tổ chức trước khi đăng tài nguyên.</p>
      ) : (
        <form onSubmit={onSubmit} className="uikit-card uikit-stack">
          <TextField
            label="Tên tài nguyên"
            required
            placeholder="Vd: Đặc tính cơ học của composite vỏ trấu"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <SelectField
            label="Tổ chức sở hữu"
            value={form.ownerOrganizationId}
            onChange={(e) => setForm({ ...form, ownerOrganizationId: e.target.value })}
            options={organizations.map((o) => ({ value: o.id, label: o.name }))}
          />
          <SelectField
            label="Loại tài nguyên"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as RegisterResourceRequest["type"] })}
            options={Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <TextField
            label="Mô tả ngắn"
            as="textarea"
            optional
            placeholder="Tóm tắt nội dung tài nguyên..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <SelectField
            label="Quyền truy cập"
            value={form.accessLevel}
            onChange={(e) => setForm({ ...form, accessLevel: e.target.value as RegisterResourceRequest["accessLevel"] })}
            options={Object.entries(RESOURCE_ACCESS_LEVEL_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <label className="uikit-field">
            <span className="uikit-field__label">Tệp tài liệu</span>
            <input
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="uikit-field__hint">PDF, JPG hoặc PNG, tối đa 200 MB.</span>
          </label>

          {status === "error" && errorMessage && (
            <p className="uikit-alert-error" role="alert">
              {errorMessage}
            </p>
          )}

          <PrimaryButton type="submit" full disabled={status === "loading"}>
            {status === "loading" ? "Đang đăng…" : "Đăng tài nguyên"}
          </PrimaryButton>
        </form>
      )}
      </div>
    </Shell>
  );
}
