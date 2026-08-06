"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationResponse, RegisterTechnologyCaseRequest, TechnologyCaseResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { getAccessToken } from "../../../lib/session";
import { FormField } from "../../_components/FormField";
import { SiteHeader } from "../../_components/SiteHeader";

export default function NewTechnologyCasePage() {
  const router = useRouter();
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
    authFetch<OrganizationResponse[]>("/organizations")
      .then((orgs) => {
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setForm((f) => ({ ...f, owningOrganizationId: orgs[0]?.id ?? "" }));
        }
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

  return (
    <div className="shell">
      <SiteHeader />
      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)", maxWidth: 640 }}>
        <span className="eyebrow">Phase 3</span>
        <h1 style={{ fontSize: 30, marginTop: "var(--space-4)" }}>Tạo Technology Case</h1>

        {organizations === null ? null : organizations.length === 0 ? (
          <p className="empty-state" style={{ marginTop: "var(--space-6)" }}>
            Bạn cần là thành viên của ít nhất 1 tổ chức trước khi tạo case.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="card" style={{ marginTop: "var(--space-6)" }}>
            <div className="form-stack">
              <FormField label="Tổ chức chủ trì">
                <select
                  value={form.owningOrganizationId}
                  onChange={(e) => setForm({ ...form, owningOrganizationId: e.target.value })}
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Tiêu đề">
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </FormField>
              <FormField label="Mô tả" optional>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>
              <FormField label="Tóm tắt công nghệ" optional>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </FormField>
            </div>

            {status === "error" && errorMessage && (
              <p className="alert alert-error" role="alert" style={{ marginTop: "var(--space-5)" }}>
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={status === "loading"}
              style={{ marginTop: "var(--space-6)" }}
            >
              {status === "loading" ? "Đang tạo…" : "Tạo case"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
