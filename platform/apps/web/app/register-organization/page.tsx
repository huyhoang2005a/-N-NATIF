"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OrganizationResponse, RegisterOrganizationRequest } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS } from "../../lib/labels";
import { FormField } from "../_components/FormField";
import { RegistryStepper } from "../_components/RegistryStepper";
import { Seal } from "../_components/Seal";
import { SiteHeader } from "../_components/SiteHeader";
import { slugify } from "../_lib/slugify";

const initialForm: RegisterOrganizationRequest = {
  organizationName: "",
  organizationType: "RESEARCH_UNIT",
  website: "",
  taxCode: "",
  institutionIdentifier: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerDisplayName: "",
};

export default function RegisterOrganizationPage() {
  const [form, setForm] = useState<RegisterOrganizationRequest>(initialForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationResponse | null>(null);

  const slugPreview = useMemo(() => slugify(form.organizationName), [form.organizationName]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    try {
      const payload: RegisterOrganizationRequest = {
        ...form,
        website: form.website || undefined,
        taxCode: form.taxCode || undefined,
        institutionIdentifier: form.institutionIdentifier || undefined,
      };
      const org = await apiFetch<OrganizationResponse>("/organizations/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOrganization(org);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof ApiError ? describeErrorCode(error.code) : "Nộp hồ sơ thất bại.");
    }
  }

  return (
    <div className="shell">
      <SiteHeader />

      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)" }}>
        {status === "success" && organization ? (
          <div style={{ maxWidth: 480, margin: "var(--space-7) auto 0" }}>
            <div className="dossier">
              <div className="dossier__stub">
                <span>Hồ sơ đã nộp</span>
                <span className="badge badge-pending badge-on-dark">
                  {ORG_STATUS_LABELS[organization.status] ?? organization.status}
                </span>
              </div>
              <div className="dossier__perforation" />
              <div className="dossier__body">
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-5)" }}>
                  <Seal size={92} />
                </div>
                <h1 style={{ fontSize: 24, textAlign: "center" }}>
                  Hồ sơ tổ chức &laquo;{organization.name}&raquo; đã được nộp
                </h1>
                <p style={{ marginTop: "var(--space-3)", fontSize: 14, color: "var(--ink-700)", textAlign: "center" }}>
                  Chuyên viên thẩm định sẽ xem xét trong thời gian sớm nhất. Bạn sẽ nhận thông báo khi có kết quả.
                </p>
                <div style={{ marginTop: "var(--space-6)" }}>
                  <RegistryStepper current={0} />
                </div>
                <Link href="/" className="btn btn-ghost btn-block" style={{ marginTop: "var(--space-6)" }}>
                  ← Về trang chủ
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="register-grid">
            <div>
              <span className="eyebrow">Hồ sơ mới</span>
              <h1 style={{ fontSize: 34, marginTop: "var(--space-4)", maxWidth: "13ch" }}>Đăng ký tổ chức</h1>
              <p style={{ marginTop: "var(--space-4)", color: "var(--ink-700)", fontSize: 15, maxWidth: "38ch" }}>
                Điền thông tin tổ chức và người đại diện. Hồ sơ sẽ được chuyển cho chuyên viên thẩm định
                trước khi tổ chức hoạt động đầy đủ trên R2M.
              </p>
              <div style={{ marginTop: "var(--space-7)" }}>
                <RegistryStepper current={0} />
              </div>
            </div>

            <div className="dossier" style={{ alignSelf: "start" }}>
              <div className="dossier__stub">
                <span>Sổ đăng ký R2M</span>
                <span>Bước 1/3</span>
              </div>
              <div className="dossier__perforation" />
              <div className="dossier__body">
                <form onSubmit={onSubmit}>
                  <section className="form-section">
                    <span className="eyebrow">Tổ chức</span>
                    <div className="form-stack" style={{ marginTop: "var(--space-4)" }}>
                      <FormField label="Tên tổ chức" hint={slugPreview ? `Định danh: ${slugPreview}` : undefined}>
                        <input
                          required
                          value={form.organizationName}
                          onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Loại tổ chức">
                        <select
                          value={form.organizationType}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              organizationType: e.target.value as RegisterOrganizationRequest["organizationType"],
                            })
                          }
                        >
                          {Object.entries(ORG_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <div className="field-row">
                        <FormField label="Website" optional>
                          <input
                            type="url"
                            placeholder="https://…"
                            value={form.website ?? ""}
                            onChange={(e) => setForm({ ...form, website: e.target.value })}
                          />
                        </FormField>
                        <FormField label="Mã số thuế" optional>
                          <input
                            value={form.taxCode ?? ""}
                            onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                          />
                        </FormField>
                      </div>
                      <FormField label="Mã định danh tổ chức" optional hint="Ví dụ: mã đơn vị chủ quản, mã trường.">
                        <input
                          value={form.institutionIdentifier ?? ""}
                          onChange={(e) => setForm({ ...form, institutionIdentifier: e.target.value })}
                        />
                      </FormField>
                    </div>
                  </section>

                  <section className="form-section">
                    <span className="eyebrow">Người đại diện</span>
                    <div className="form-stack" style={{ marginTop: "var(--space-4)" }}>
                      <FormField label="Họ tên">
                        <input
                          required
                          value={form.ownerDisplayName}
                          onChange={(e) => setForm({ ...form, ownerDisplayName: e.target.value })}
                        />
                      </FormField>
                      <div className="field-row">
                        <FormField label="Email">
                          <input
                            type="email"
                            required
                            value={form.ownerEmail}
                            onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                          />
                        </FormField>
                        <FormField label="Mật khẩu" hint="Tối thiểu 8 ký tự.">
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={form.ownerPassword}
                            onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                          />
                        </FormField>
                      </div>
                    </div>
                  </section>

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
                    {status === "loading" ? "Đang nộp hồ sơ…" : "Nộp hồ sơ đăng ký"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
