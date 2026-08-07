"use client";

import { useState } from "react";
import Link from "next/link";
import type { OrganizationResponse, RegisterOrganizationRequest } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { ORG_TYPE_LABELS } from "../../lib/labels";
import { toneOf, ORGANIZATION_STATUS_TONE } from "../../lib/tone";
import { BrandMark, PrimaryButton, SelectField, StatusPill, TextField } from "../../components/ui";

const ORG_TYPE_HINT: Record<RegisterOrganizationRequest["organizationType"], string> = {
  RESEARCH_UNIT: "Viện nghiên cứu, trường đại học, trung tâm R&D.",
  ENTERPRISE: "Doanh nghiệp muốn tìm và tiếp nhận công nghệ.",
  GOVERNMENT: "Cơ quan quản lý nhà nước, đơn vị công lập.",
  SUPPORT_ORGANIZATION: "Tổ chức trung gian: kiểm định, tư vấn, chuyển giao.",
};

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
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [form, setForm] = useState<RegisterOrganizationRequest>(initialForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationResponse | null>(null);
  const [showMore, setShowMore] = useState(false);

  const step1Valid =
    form.ownerDisplayName.trim().length > 0 &&
    form.ownerEmail.trim().length > 0 &&
    form.ownerPassword.length >= 8 &&
    form.ownerPassword === confirmPassword;

  function onContinue(event: React.FormEvent) {
    event.preventDefault();
    if (step1Valid) setStep(2);
  }

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
      setErrorMessage(error instanceof ApiError ? describeErrorCode(error.code) : "Đăng ký thất bại.");
    }
  }

  if (status === "success" && organization) {
    return (
      <div className="uikit-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 440, padding: "var(--space-6) var(--space-5)" }}>
          <div className="uikit-card" style={{ textAlign: "center" }}>
            <BrandMark size="lg" />
            <h1 style={{ fontSize: 20, marginTop: "var(--space-4)" }}>
              Đăng ký thành công «{organization.name}»
            </h1>
            <div style={{ marginTop: "var(--space-3)" }}>
              <StatusPill tone={toneOf(ORGANIZATION_STATUS_TONE, organization.status)}>
                Chờ kiểm định viên duyệt
              </StatusPill>
            </div>
            <p style={{ marginTop: "var(--space-4)", fontSize: 14, color: "var(--uikit-slate-500)" }}>
              Bạn có thể đăng nhập ngay. Một số chức năng (đăng tài nguyên, tạo case) sẽ mở
              khi tổ chức được kiểm định viên duyệt.
            </p>
            <Link href="/login" className="uikit-btn uikit-btn--primary uikit-btn--full" style={{ marginTop: "var(--space-5)" }}>
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="uikit-shell" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, padding: "var(--space-6) var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <BrandMark size="lg" />
          <h1 style={{ fontSize: 22, marginTop: "var(--space-4)" }}>Đăng ký tổ chức</h1>
          <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-slate-500)", textAlign: "center" }}>
            Mọi tài khoản trên R2M — kể cả tác giả cá nhân — đều đăng ký thông qua một tổ
            chức (viện nghiên cứu, doanh nghiệp, cơ quan nhà nước hoặc tổ chức trung gian).
          </p>
        </div>

        <div className="uikit-card">
          {step === 1 ? (
            <form onSubmit={onContinue} className="uikit-stack">
              <TextField
                label="Họ tên người đại diện"
                required
                value={form.ownerDisplayName}
                onChange={(e) => setForm({ ...form, ownerDisplayName: e.target.value })}
              />
              <TextField
                label="Email"
                type="email"
                required
                value={form.ownerEmail}
                onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
              />
              <TextField
                label="Mật khẩu"
                type="password"
                required
                hint="Tối thiểu 8 ký tự."
                value={form.ownerPassword}
                onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
              />
              <TextField
                label="Nhập lại mật khẩu"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {form.ownerPassword.length > 0 &&
                confirmPassword.length > 0 &&
                form.ownerPassword !== confirmPassword && (
                  <p className="uikit-alert-error" role="alert">
                    Mật khẩu nhập lại không khớp.
                  </p>
                )}
              <PrimaryButton type="submit" full disabled={!step1Valid}>
                Tiếp tục
              </PrimaryButton>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="uikit-stack">
              <button type="button" onClick={() => setStep(1)} className="uikit-backlink" style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
                ← Quay lại
              </button>
              <TextField
                label="Tên tổ chức"
                required
                value={form.organizationName}
                onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
              />
              <SelectField
                label="Loại tổ chức"
                value={form.organizationType}
                onChange={(e) =>
                  setForm({ ...form, organizationType: e.target.value as RegisterOrganizationRequest["organizationType"] })
                }
                hint={ORG_TYPE_HINT[form.organizationType]}
                options={Object.entries(ORG_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />

              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                style={{
                  alignSelf: "flex-start",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--uikit-indigo-700)",
                }}
              >
                {showMore ? "− Ẩn thông tin bổ sung" : "+ Thông tin bổ sung (tuỳ chọn)"}
              </button>

              {showMore && (
                <div className="uikit-stack">
                  <TextField
                    label="Website"
                    type="url"
                    optional
                    placeholder="https://…"
                    value={form.website ?? ""}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                  <TextField
                    label="Mã số thuế"
                    optional
                    value={form.taxCode ?? ""}
                    onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                  />
                  <TextField
                    label="Mã định danh tổ chức"
                    optional
                    hint="Ví dụ: mã đơn vị chủ quản, mã trường."
                    value={form.institutionIdentifier ?? ""}
                    onChange={(e) => setForm({ ...form, institutionIdentifier: e.target.value })}
                  />
                </div>
              )}

              {status === "error" && errorMessage && (
                <p className="uikit-alert-error" role="alert">
                  {errorMessage}
                </p>
              )}

              <PrimaryButton type="submit" full disabled={status === "loading" || !form.organizationName.trim()}>
                {status === "loading" ? "Đang đăng ký…" : "Hoàn tất đăng ký"}
              </PrimaryButton>
            </form>
          )}
        </div>

        <p style={{ marginTop: "var(--space-5)", fontSize: 13, color: "var(--uikit-slate-500)", textAlign: "center" }}>
          Đã có tài khoản?{" "}
          <Link href="/login" style={{ color: "var(--uikit-indigo-700)", fontWeight: 500 }}>
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
