"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse, RegisterTechnologyCaseRequest, TechnologyCaseResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { BackLink, PageLoader, PrimaryButton, SelectField, Shell, TextField } from "../../../components/ui";

export default function NewTechnologyCasePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    owningOrganizationId: "",
    title: "",
    description: "",
    summary: "",
  });
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
        if (orgs.length > 0) setForm((f) => ({ ...f, owningOrganizationId: orgs[0]?.id ?? "" }));
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
    setStatus("loading");
    setErrorMessage(null);
    try {
      const payload: RegisterTechnologyCaseRequest = {
        owningOrganizationId: form.owningOrganizationId,
        title: form.title,
        description: form.description || undefined,
        summary: form.summary || undefined,
      };
      const created = await authFetch<TechnologyCaseResponse>("/technology-cases", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/technology-cases/${created.id}`);
    } catch (err) {
      setStatus("error");
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setErrorMessage(err instanceof ApiError ? describeErrorCode(err.code) : "Tạo case thất bại.");
    }
  }

  if (!me || !organizations) return <PageLoader />;
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
        <BackLink href="/technology-cases">Quay lại danh sách case</BackLink>
        <h1 style={{ fontSize: 22, marginBottom: "var(--space-5)" }}>Tạo Technology Case</h1>

        {organizations.length === 0 ? (
          <p className="uikit-empty">Bạn cần là thành viên của ít nhất 1 tổ chức trước khi tạo case.</p>
        ) : (
          <form onSubmit={onSubmit} className="uikit-card uikit-stack">
            <SelectField
              label="Tổ chức chủ trì"
              value={form.owningOrganizationId}
              onChange={(e) => setForm({ ...form, owningOrganizationId: e.target.value })}
              options={organizations.map((org) => ({ value: org.id, label: org.name }))}
            />
            <TextField label="Tiêu đề" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <TextField
              label="Mô tả"
              as="textarea"
              optional
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextField
              label="Tóm tắt công nghệ"
              as="textarea"
              optional
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />

            {status === "error" && errorMessage && (
              <p className="uikit-alert-error" role="alert">
                {errorMessage}
              </p>
            )}

            <PrimaryButton type="submit" full disabled={status === "loading"}>
              {status === "loading" ? "Đang tạo…" : "Tạo case"}
            </PrimaryButton>
          </form>
        )}
      </div>
    </Shell>
  );
}
