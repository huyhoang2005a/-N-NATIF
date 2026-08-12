"use client";

import { useState } from "react";
import Link from "next/link";
import type { OrganizationMemberResponse, OrganizationResponse, RegisterOrganizationRequest } from "@r2m/contracts";
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { ORG_TYPE_LABELS, ORG_VERIFICATION_DOCUMENT_TYPE_LABELS } from "../../lib/labels";
import { toneOf, ORGANIZATION_STATUS_TONE } from "../../lib/tone";
import { BackLink, BrandMark, FileField, PrimaryButton, SelectField, StatusPill, TextField } from "../../components/ui";

const ORG_TYPE_HINT: Record<RegisterOrganizationRequest["organizationType"], string> = {
  RESEARCH_UNIT: "Viện nghiên cứu, trường đại học, trung tâm R&D.",
  ENTERPRISE: "Doanh nghiệp muốn tìm và tiếp nhận công nghệ.",
  GOVERNMENT: "Cơ quan quản lý nhà nước, đơn vị công lập.",
  SUPPORT_ORGANIZATION: "Tổ chức trung gian: kiểm định, tư vấn, chuyển giao.",
};

const ORG_DOCUMENT_TYPE_OPTIONS = Object.entries(ORG_VERIFICATION_DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

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

interface DomainConflict {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
}

export default function RegisterOrganizationPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [form, setForm] = useState<RegisterOrganizationRequest>(initialForm);
  const [docType, setDocType] = useState("TAX_DOCUMENT");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domainConflict, setDomainConflict] = useState<DomainConflict | null>(null);
  const [organization, setOrganization] = useState<OrganizationResponse | null>(null);
  const [showMore, setShowMore] = useState(false);

  const [joinStatus, setJoinStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [joinError, setJoinError] = useState<string | null>(null);

  const step1Valid =
    form.ownerDisplayName.trim().length > 0 &&
    form.ownerEmail.trim().length > 0 &&
    form.ownerPassword.length >= 8 &&
    form.ownerPassword === confirmPassword;

  function onContinueStep1(event: React.FormEvent) {
    event.preventDefault();
    if (step1Valid) setStep(2);
  }

  function onContinueStep2(event: React.FormEvent) {
    event.preventDefault();
    if (form.organizationName.trim()) setStep(3);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!docFile) {
      setDocError("Vui lòng chọn tệp tài liệu.");
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
    setDomainConflict(null);
    try {
      const formData = new FormData();
      formData.append("organizationName", form.organizationName);
      formData.append("organizationType", form.organizationType);
      if (form.website) formData.append("website", form.website);
      if (form.taxCode) formData.append("taxCode", form.taxCode);
      if (form.institutionIdentifier) formData.append("institutionIdentifier", form.institutionIdentifier);
      formData.append("ownerEmail", form.ownerEmail);
      formData.append("ownerPassword", form.ownerPassword);
      formData.append("ownerDisplayName", form.ownerDisplayName);
      formData.append("documentType", docType);
      formData.append("file", docFile);

      const org = await apiFetch<OrganizationResponse>("/organizations/register", {
        method: "POST",
        body: formData,
      });
      setOrganization(org);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      if (error instanceof ApiError && error.code === "ORG_DOMAIN_ALREADY_REGISTERED" && error.details) {
        setDomainConflict(error.details as unknown as DomainConflict);
        return;
      }
      setErrorMessage(error instanceof ApiError ? describeErrorCode(error.code) : "Đăng ký thất bại.");
    }
  }

  async function onJoinRequest() {
    if (!domainConflict) return;
    setJoinStatus("loading");
    setJoinError(null);
    try {
      await apiFetch<OrganizationMemberResponse>(`/organizations/${domainConflict.organizationId}/join-requests`, {
        method: "POST",
        body: JSON.stringify({
          displayName: form.ownerDisplayName,
          email: form.ownerEmail,
          password: form.ownerPassword,
        }),
      });
      setJoinStatus("success");
    } catch (error) {
      setJoinStatus("error");
      setJoinError(error instanceof ApiError ? describeErrorCode(error.code) : "Gửi yêu cầu thất bại.");
    }
  }

  if (joinStatus === "success") {
    return (
      <div className="uikit-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 440, padding: "var(--space-6) var(--space-5)" }}>
          <div className="uikit-card" style={{ textAlign: "center" }}>
            <BrandMark size="lg" />
            <h1 style={{ fontSize: 20, marginTop: "var(--space-4)" }}>Đã gửi yêu cầu tham gia</h1>
            <p style={{ marginTop: "var(--space-4)", fontSize: 14, color: "var(--uikit-slate-500)" }}>
              Tài khoản của bạn đã được tạo và đăng nhập được ngay. Yêu cầu tham gia «
              {domainConflict?.organizationName}» đang chờ quản trị viên tổ chức duyệt — bạn
              sẽ nhận được thông báo khi có kết quả.
            </p>
            <Link href="/login" className="uikit-btn uikit-btn--primary uikit-btn--full" style={{ marginTop: "var(--space-5)" }}>
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    );
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
              Bạn có thể đăng nhập ngay. Kiểm tra hộp thư để xác thực email — tài liệu xác
              minh đã được nộp kèm đăng ký, kiểm định viên sẽ xem xét và duyệt tổ chức.
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
        <BackLink href="/">Về trang chủ</BackLink>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <BrandMark size="lg" />
          <h1 style={{ fontSize: 22, marginTop: "var(--space-4)" }}>Đăng ký tổ chức</h1>
          <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-slate-500)", textAlign: "center" }}>
            Mọi tài khoản trên R2M — kể cả tác giả cá nhân — đều đăng ký thông qua một tổ
            chức (viện nghiên cứu, doanh nghiệp, cơ quan nhà nước hoặc tổ chức trung gian).
          </p>
        </div>

        <div className="uikit-card">
          {step === 1 && (
            <form onSubmit={onContinueStep1} className="uikit-stack">
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
          )}

          {step === 2 && (
            <form onSubmit={onContinueStep2} className="uikit-stack">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="uikit-backlink"
                style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
              >
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

              <PrimaryButton type="submit" full disabled={!form.organizationName.trim()}>
                Tiếp tục
              </PrimaryButton>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={onSubmit} className="uikit-stack">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="uikit-backlink"
                style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
              >
                ← Quay lại
              </button>
              <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
                Kiểm định viên cần ít nhất 1 tài liệu để xác minh tổ chức trước khi duyệt.
                Bắt buộc nộp ngay trong bước đăng ký.
              </p>
              <SelectField
                label="Loại tài liệu"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                options={ORG_DOCUMENT_TYPE_OPTIONS}
              />
              <FileField
                label="Tệp tài liệu"
                required
                accept="application/pdf,image/jpeg,image/png"
                hint="PDF, JPG hoặc PNG, tối đa 20 MB."
                maxSizeBytes={MAX_DOCUMENT_SIZE_BYTES}
                allowedMimeTypes={ALLOWED_DOCUMENT_MIME_TYPES}
                onChange={setDocFile}
                onValidationError={setDocError}
              />
              {docError && (
                <p className="uikit-alert-error" role="alert">
                  {docError}
                </p>
              )}

              {domainConflict ? (
                <div
                  style={{
                    border: "1px solid var(--uikit-amber-200)",
                    background: "var(--uikit-amber-50)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-4)",
                  }}
                >
                  <p style={{ fontSize: 13, color: "var(--uikit-amber-800)" }}>
                    Tổ chức «{domainConflict.organizationName}» đã đăng ký với domain email
                    này rồi.
                  </p>
                  {domainConflict.organizationStatus === "ACTIVE" ? (
                    <>
                      <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-amber-800)" }}>
                        Bạn có thể gửi yêu cầu tham gia tổ chức này thay vì tạo tổ chức mới —
                        dùng đúng tên, email, mật khẩu đã nhập ở bước 1.
                      </p>
                      {joinError && (
                        <p className="uikit-alert-error" role="alert" style={{ marginTop: "var(--space-2)" }}>
                          {joinError}
                        </p>
                      )}
                      <PrimaryButton
                        type="button"
                        full
                        disabled={joinStatus === "loading"}
                        onClick={onJoinRequest}
                        style={{ marginTop: "var(--space-3)" }}
                      >
                        {joinStatus === "loading" ? "Đang gửi…" : "Gửi yêu cầu tham gia tổ chức này"}
                      </PrimaryButton>
                    </>
                  ) : (
                    <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-amber-800)" }}>
                      Tổ chức đó chưa được kích hoạt (đang chờ xác minh) nên chưa nhận yêu cầu
                      tham gia lúc này. Vui lòng liên hệ quản trị viên tổ chức đó.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {status === "error" && errorMessage && (
                    <p className="uikit-alert-error" role="alert">
                      {errorMessage}
                    </p>
                  )}
                  <PrimaryButton type="submit" full disabled={status === "loading"}>
                    {status === "loading" ? "Đang đăng ký…" : "Hoàn tất đăng ký"}
                  </PrimaryButton>
                </>
              )}
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
