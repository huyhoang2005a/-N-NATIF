"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, UserPlus } from "lucide-react";
import type {
  AuthorVerificationRequestResponse,
  AuthorVerificationUploadResponse,
  CompanyProfileResponse,
  CreateCompanyProfileRequest,
  MeResponse,
  OrganizationMemberResponse,
  OrganizationResponse,
  OrganizationVerificationRequestResponse,
  PendingMembershipResponse,
  UpdateProfileRequest,
  UserProfileResponse,
} from "@r2m/contracts";
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import {
  ORG_STATUS_LABELS,
  ORG_TYPE_LABELS,
  ORG_VERIFICATION_DOCUMENT_TYPE_LABELS,
  PLATFORM_ROLE_LABELS,
  VERIFICATION_REQUEST_STATUS_LABELS,
} from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { toneOf, ORGANIZATION_STATUS_TONE, VERIFICATION_REQUEST_STATUS_TONE } from "../../lib/tone";
import { Card, FileField, GhostButton, PageLoader, PrimaryButton, SectionHeader, SelectField, Shell, StatusPill, TextField } from "../../components/ui";

const DOCUMENT_TYPE_OPTIONS = [
  { value: "IDENTITY_DOCUMENT", label: "Giấy tờ tuỳ thân" },
  { value: "AFFILIATION_PROOF", label: "Minh chứng đơn vị công tác" },
  { value: "ORGANIZATION_LETTER", label: "Thư xác nhận của tổ chức" },
  { value: "TAX_DOCUMENT", label: "Giấy tờ thuế" },
  { value: "OTHER", label: "Khác" },
];

const ORG_DOCUMENT_TYPE_OPTIONS = Object.entries(ORG_VERIFICATION_DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const RESEND_COOLDOWN_SECONDS = 60;

const INVITE_ROLE_OPTIONS = [
  { value: "MEMBER", label: "Thành viên" },
  { value: "ORG_ADMIN", label: "Quản trị viên tổ chức" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [pendingMemberships, setPendingMemberships] = useState<PendingMembershipResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateProfileRequest>({});
  const [editStatus, setEditStatus] = useState<"idle" | "loading" | "error">("idle");
  const [editError, setEditError] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "loading">("idle");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [verifyForm, setVerifyForm] = useState({ affiliationOrgId: "", documentType: "IDENTITY_DOCUMENT", submittedNote: "" });
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "loading" | "error">("idle");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<AuthorVerificationRequestResponse | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<UserProfileResponse>("/me/profile"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<PendingMembershipResponse[]>("/me/pending-memberships"),
    ])
      .then(([meResponse, profileResponse, orgs, pendingMemberships]) => {
        setMe(meResponse);
        setProfile(profileResponse);
        setOrganizations(orgs);
        setPendingMemberships(pendingMemberships);
        setEditForm({
          displayName: profileResponse.displayName,
          firstName: profileResponse.firstName ?? "",
          lastName: profileResponse.lastName ?? "",
          phone: profileResponse.phone ?? "",
          jobTitle: profileResponse.jobTitle ?? "",
        });
        if (orgs.length > 0) setVerifyForm((f) => ({ ...f, affiliationOrgId: orgs[0]?.id ?? "" }));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setLoadError("Không tải được hồ sơ.");
      });
  }, [router]);

  async function onChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError("Mật khẩu mới nhập lại không khớp.");
      return;
    }
    setPasswordStatus("loading");
    try {
      await authFetch("/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setPasswordSuccess(true);
      setShowPasswordForm(false);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setPasswordError(err instanceof ApiError ? describeErrorCode(err.code) : "Đổi mật khẩu thất bại.");
    } finally {
      setPasswordStatus("idle");
    }
  }

  async function onSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setEditStatus("loading");
    setEditError(null);
    try {
      const updated = await authFetch<UserProfileResponse>("/me/profile", {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      setEditStatus("error");
      setEditError(err instanceof ApiError ? describeErrorCode(err.code) : "Cập nhật thất bại.");
    } finally {
      setEditStatus("idle");
    }
  }

  async function onSubmitVerification(event: React.FormEvent) {
    event.preventDefault();
    if (!verifyFile) {
      setVerifyStatus("error");
      setVerifyError("Vui lòng chọn tệp tài liệu.");
      return;
    }
    setVerifyStatus("loading");
    setVerifyError(null);
    try {
      const upload = await authFetch<AuthorVerificationUploadResponse>("/author-verifications/uploads", {
        method: "POST",
        body: JSON.stringify({
          documentType: verifyForm.documentType,
          originalFilename: verifyFile.name,
          mimeType: verifyFile.type,
          sizeBytes: verifyFile.size,
        }),
      });
      const putResponse = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": verifyFile.type },
        body: verifyFile,
      });
      if (!putResponse.ok) throw new Error("upload failed");

      const result = await authFetch<AuthorVerificationRequestResponse>("/author-verifications", {
        method: "POST",
        body: JSON.stringify({
          affiliationOrgId: verifyForm.affiliationOrgId,
          submittedNote: verifyForm.submittedNote || undefined,
          documentStorageObjectKey: upload.storageObjectKey,
          documentType: verifyForm.documentType,
          originalFilename: verifyFile.name,
          mimeType: verifyFile.type,
          sizeBytes: verifyFile.size,
        }),
      });
      setVerifyResult(result);
      setShowVerifyForm(false);
    } catch (err) {
      setVerifyStatus("error");
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setVerifyError(err instanceof ApiError ? describeErrorCode(err.code) : "Gửi yêu cầu xác minh thất bại.");
    } finally {
      setVerifyStatus("idle");
    }
  }

  const [orgActionBusy, setOrgActionBusy] = useState<string | null>(null);
  const [orgActionError, setOrgActionError] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "MEMBER" });
  const [inviteResult, setInviteResult] = useState<OrganizationMemberResponse | null>(null);

  const [pendingMembers, setPendingMembers] = useState<OrganizationMemberResponse[] | null>(null);
  const [memberActionBusy, setMemberActionBusy] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizations || organizations.length === 0) return;
    const primaryOrgId = organizations[0]!.id;
    authFetch<OrganizationMemberResponse[]>(`/organizations/${primaryOrgId}/members`)
      .then((members) => setPendingMembers(members.filter((m) => m.status === "PENDING_APPROVAL")))
      // Not owner/admin (AUTH_FORBIDDEN) or any other failure — just don't show the
      // section, no need to surface an error for something the actor isn't meant to see.
      .catch(() => setPendingMembers(null));
  }, [organizations]);

  function onDecideJoinRequest(organizationId: string, memberId: string, decision: "ACTIVE" | "LEFT") {
    setMemberActionBusy(memberId);
    setMemberActionError(null);
    authFetch<OrganizationMemberResponse>(`/organizations/${organizationId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: decision }),
    })
      .then((updated) => {
        setPendingMembers((prev) => (prev ? prev.filter((m) => m.id !== updated.id) : prev));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setMemberActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại.");
      })
      .finally(() => setMemberActionBusy(null));
  }

  const [orgDocForm, setOrgDocForm] = useState({ documentType: "TAX_DOCUMENT" });
  const [orgDocFile, setOrgDocFile] = useState<File | null>(null);
  const [orgDocStatus, setOrgDocStatus] = useState<"idle" | "loading">("idle");
  const [orgDocError, setOrgDocError] = useState<string | null>(null);
  const [orgDocResult, setOrgDocResult] = useState<OrganizationVerificationRequestResponse | null>(null);

  function onSubmitOrgDocument(organizationId: string, mode: "resubmit" | "attach", event: React.FormEvent) {
    event.preventDefault();
    if (!orgDocFile) {
      setOrgDocError("Vui lòng chọn tệp tài liệu.");
      return;
    }
    setOrgDocStatus("loading");
    setOrgDocError(null);
    const formData = new FormData();
    formData.append("documentType", orgDocForm.documentType);
    formData.append("file", orgDocFile);
    const path =
      mode === "resubmit"
        ? `/organizations/${organizationId}/verification-requests`
        : `/organizations/${organizationId}/verification-requests/documents`;
    authFetch<OrganizationVerificationRequestResponse>(path, { method: "POST", body: formData })
      .then((result) => {
        setOrgDocResult(result);
        setOrgDocFile(null);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setOrgDocError(err instanceof ApiError ? describeErrorCode(err.code) : "Nộp tài liệu thất bại.");
      })
      .finally(() => setOrgDocStatus("idle"));
  }

  const [companyProfile, setCompanyProfile] = useState<CompanyProfileResponse | null | undefined>(undefined);
  const [companyProfileEditing, setCompanyProfileEditing] = useState(false);
  const [companyProfileForm, setCompanyProfileForm] = useState<CreateCompanyProfileRequest>({});
  const [companyProfileStatus, setCompanyProfileStatus] = useState<"idle" | "loading">("idle");
  const [companyProfileError, setCompanyProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizations || organizations.length === 0) return;
    const primaryOrg = organizations[0]!;
    if (primaryOrg.type !== "ENTERPRISE" || primaryOrg.status !== "ACTIVE") return;
    authFetch<CompanyProfileResponse>(`/organizations/${primaryOrg.id}/company-profile`)
      .then((p) => {
        setCompanyProfile(p);
        setCompanyProfileForm({ industryCode: p.industryCode ?? undefined, companySize: p.companySize ?? undefined, description: p.description ?? undefined });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === "DISCOVERY_COMPANY_PROFILE_NOT_FOUND") {
          setCompanyProfile(null);
          return;
        }
        // Any other failure (e.g. not owner/admin viewing before membership sync) — just
        // don't show the section, matching the pendingMembers card's pattern above.
        setCompanyProfile(null);
      });
  }, [organizations]);

  function onSaveCompanyProfile(organizationId: string, mode: "create" | "update", event: React.FormEvent) {
    event.preventDefault();
    setCompanyProfileStatus("loading");
    setCompanyProfileError(null);
    authFetch<CompanyProfileResponse>(`/organizations/${organizationId}/company-profile`, {
      method: mode === "create" ? "POST" : "PATCH",
      body: JSON.stringify(companyProfileForm),
    })
      .then((p) => {
        setCompanyProfile(p);
        setCompanyProfileEditing(false);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setCompanyProfileError(err instanceof ApiError ? describeErrorCode(err.code) : "Lưu hồ sơ công ty thất bại.");
      })
      .finally(() => setCompanyProfileStatus("idle"));
  }

  const [resendStatus, setResendStatus] = useState<"idle" | "loading">("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [, setResendTick] = useState(0);

  useEffect(() => {
    if (resendCooldownUntil === null) return;
    const interval = setInterval(() => {
      if (Date.now() >= resendCooldownUntil) {
        setResendCooldownUntil(null);
      } else {
        setResendTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldownUntil]);

  const resendSecondsLeft = resendCooldownUntil ? Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000)) : 0;

  function onResendVerificationEmail() {
    setResendStatus("loading");
    setResendError(null);
    authFetch("/email-verifications/resend", { method: "POST" })
      .then(() => {
        setResendCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        if (err instanceof ApiError && err.code === "AUTH_EMAIL_VERIFICATION_RATE_LIMITED") {
          setResendCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
          return;
        }
        setResendError(err instanceof ApiError ? describeErrorCode(err.code) : "Gửi email xác thực thất bại.");
      })
      .finally(() => setResendStatus("idle"));
  }

  function onInviteMember(organizationId: string, event: React.FormEvent) {
    event.preventDefault();
    setOrgActionBusy("invite");
    setOrgActionError(null);
    authFetch<OrganizationMemberResponse>(`/organizations/${organizationId}/members/invitations`, {
      method: "POST",
      body: JSON.stringify(inviteForm),
    })
      .then((member) => {
        setInviteResult(member);
        setInviteForm({ email: "", role: "MEMBER" });
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setOrgActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Mời thành viên thất bại.");
      })
      .finally(() => setOrgActionBusy(null));
  }

  if (!me) {
    if (loadError) {
      return (
        <div className="uikit-main" style={{ maxWidth: 640, margin: "0 auto" }}>
          <p className="uikit-alert-error" role="alert">
            {loadError}
          </p>
        </div>
      );
    }
    return <PageLoader />;
  }

  const roleLabel = PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole;

  if (!profile || !organizations) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={navForPersona(personaOf(me, []), false)}>
        <PageLoader inline />
      </Shell>
    );
  }

  const persona = personaOf(me, organizations);
  const nav = navForPersona(persona, me.platformRole === "PLATFORM_ADMIN");
  const showAuthorVerification = me.platformRole === "USER";

  const initials = profile.displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
      <div className="uikit-stack" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 22 }}>Hồ sơ tài khoản</h1>

        {!me.emailVerified && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
              <div>
                <StatusPill tone="amber">Email chưa xác thực</StatusPill>
                <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-slate-500)" }}>
                  Kiểm tra hộp thư {me.primaryEmail} và bấm vào liên kết xác thực. Cần xác thực
                  email trước khi nộp tài liệu xác minh tổ chức hoặc tác giả.
                </p>
              </div>
              <GhostButton
                icon={RefreshCw}
                disabled={resendStatus === "loading" || resendCooldownUntil !== null}
                onClick={onResendVerificationEmail}
              >
                {resendCooldownUntil !== null
                  ? `Đã gửi — thử lại sau ${resendSecondsLeft}s`
                  : resendStatus === "loading"
                    ? "Đang gửi…"
                    : "Gửi lại email xác thực"}
              </GhostButton>
            </div>
            {resendError && (
              <p className="uikit-alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
                {resendError}
              </p>
            )}
          </Card>
        )}

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--uikit-indigo-50)",
                  color: "var(--uikit-indigo-700)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {initials || "?"}
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{profile.displayName}</p>
                <p style={{ marginTop: 2, fontSize: 13, color: "var(--uikit-slate-500)" }}>{me.primaryEmail}</p>
              </div>
            </div>
            <GhostButton onClick={() => setEditing((v) => !v)}>{editing ? "Đóng" : "Chỉnh sửa"}</GhostButton>
          </div>

          {editing && (
            <form onSubmit={onSaveProfile} className="uikit-stack" style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--uikit-slate-100)" }}>
              <TextField
                label="Tên hiển thị"
                required
                value={editForm.displayName ?? ""}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
              />
              <TextField label="Họ" optional value={editForm.lastName ?? ""} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              <TextField label="Tên" optional value={editForm.firstName ?? ""} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              <TextField label="Điện thoại" optional value={editForm.phone ?? ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              <TextField label="Chức danh" optional value={editForm.jobTitle ?? ""} onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })} />
              {editError && (
                <p className="uikit-alert-error" role="alert">
                  {editError}
                </p>
              )}
              <PrimaryButton type="submit" disabled={editStatus === "loading"}>
                {editStatus === "loading" ? "Đang lưu…" : "Lưu thay đổi"}
              </PrimaryButton>
            </form>
          )}
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionHeader title="Đổi mật khẩu" />
            <GhostButton
              onClick={() => {
                setShowPasswordForm((v) => !v);
                setPasswordError(null);
                setPasswordSuccess(false);
              }}
            >
              {showPasswordForm ? "Đóng" : "Đổi mật khẩu"}
            </GhostButton>
          </div>
          {passwordSuccess && !showPasswordForm && (
            <p style={{ fontSize: 13, color: "var(--uikit-emerald-700)" }}>Đổi mật khẩu thành công.</p>
          )}
          {showPasswordForm && (
            <form onSubmit={onChangePassword} className="uikit-stack" style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--uikit-slate-100)" }}>
              <TextField
                label="Mật khẩu hiện tại"
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              />
              <TextField
                label="Mật khẩu mới"
                type="password"
                required
                hint="Tối thiểu 8 ký tự."
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
              <TextField
                label="Nhập lại mật khẩu mới"
                type="password"
                required
                value={passwordForm.confirmNewPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
              />
              {passwordError && (
                <p className="uikit-alert-error" role="alert">
                  {passwordError}
                </p>
              )}
              <PrimaryButton type="submit" disabled={passwordStatus === "loading"}>
                {passwordStatus === "loading" ? "Đang lưu…" : "Lưu mật khẩu mới"}
              </PrimaryButton>
            </form>
          )}
        </Card>

        {organizations.length === 0 &&
          pendingMemberships.map((pm) => (
            <Card key={pm.organizationId}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{pm.organizationName}</p>
                <StatusPill tone="amber">Yêu cầu tham gia đang chờ duyệt</StatusPill>
              </div>
              <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-slate-500)" }}>
                Bạn sẽ nhận được thông báo khi quản trị viên tổ chức xử lý yêu cầu này.
              </p>
            </Card>
          ))}

        {organizations.length > 0 && (() => {
          const primaryOrg = organizations[0]!;
          return (
            <>
            <Card>
              <SectionHeader title="Tổ chức của tôi" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{primaryOrg.name}</p>
                  <p style={{ marginTop: 2, fontSize: 13, color: "var(--uikit-slate-500)" }}>{ORG_TYPE_LABELS[primaryOrg.type]}</p>
                </div>
                <StatusPill tone={toneOf(ORGANIZATION_STATUS_TONE, primaryOrg.status)}>
                  {ORG_STATUS_LABELS[primaryOrg.status] ?? primaryOrg.status}
                </StatusPill>
              </div>

              {orgActionError && (
                <p className="uikit-alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
                  {orgActionError}
                </p>
              )}

              {(primaryOrg.status === "REJECTED" || primaryOrg.status === "IN_REVIEW") && (
                <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--uikit-slate-100)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)", marginBottom: "var(--space-3)" }}>
                    {primaryOrg.status === "REJECTED" ? "Nộp lại hồ sơ xác minh" : "Bổ sung tài liệu (tuỳ chọn)"}
                  </p>
                  {orgDocResult ? (
                    <StatusPill tone="amber">Đã nộp tài liệu — chờ kiểm định viên duyệt</StatusPill>
                  ) : !me.emailVerified ? (
                    <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
                      Xác thực email (xem thông báo phía trên) trước khi nộp tài liệu xác minh.
                    </p>
                  ) : (
                    <form
                      onSubmit={(e) => onSubmitOrgDocument(primaryOrg.id, primaryOrg.status === "REJECTED" ? "resubmit" : "attach", e)}
                      className="uikit-stack"
                    >
                      <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
                        Cần ít nhất 1 giấy tờ thuế hoặc thư xác nhận của tổ chức để kiểm định viên
                        đối chiếu trước khi duyệt.
                      </p>
                      <SelectField
                        label="Loại tài liệu"
                        value={orgDocForm.documentType}
                        onChange={(e) => setOrgDocForm({ documentType: e.target.value })}
                        options={ORG_DOCUMENT_TYPE_OPTIONS}
                      />
                      <FileField
                        label="Tệp tài liệu"
                        required
                        accept="application/pdf,image/jpeg,image/png"
                        hint="PDF, JPG hoặc PNG, tối đa 20 MB."
                        maxSizeBytes={MAX_DOCUMENT_SIZE_BYTES}
                        allowedMimeTypes={ALLOWED_DOCUMENT_MIME_TYPES}
                        onChange={setOrgDocFile}
                        onValidationError={setOrgDocError}
                      />
                      {orgDocError && (
                        <p className="uikit-alert-error" role="alert">
                          {orgDocError}
                        </p>
                      )}
                      <PrimaryButton type="submit" disabled={orgDocStatus === "loading"}>
                        {orgDocStatus === "loading" ? "Đang nộp…" : "Nộp tài liệu"}
                      </PrimaryButton>
                    </form>
                  )}
                </div>
              )}

              <div style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--uikit-slate-100)" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)", marginBottom: "var(--space-3)" }}>
                  Mời thành viên
                </p>
                {inviteResult && (
                  <p style={{ fontSize: 13, color: "var(--uikit-emerald-700)", marginBottom: "var(--space-3)" }}>
                    Đã mời thành công — thành viên ở trạng thái {inviteResult.status}.
                  </p>
                )}
                <form onSubmit={(e) => onInviteMember(primaryOrg.id, e)} className="uikit-stack">
                  <TextField
                    label="Email"
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  />
                  <SelectField
                    label="Vai trò"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    options={INVITE_ROLE_OPTIONS}
                  />
                  <PrimaryButton icon={UserPlus} type="submit" disabled={orgActionBusy === "invite" || !inviteForm.email}>
                    {orgActionBusy === "invite" ? "Đang mời…" : "Mời thành viên"}
                  </PrimaryButton>
                </form>
              </div>
            </Card>

            {pendingMembers !== null && (
              <Card>
                <SectionHeader title="Yêu cầu tham gia đang chờ duyệt" />
                {memberActionError && (
                  <p className="uikit-alert-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>
                    {memberActionError}
                  </p>
                )}
                {pendingMembers.length === 0 ? (
                  <p className="uikit-empty">Không có yêu cầu nào đang chờ duyệt.</p>
                ) : (
                  <div className="uikit-stack">
                    {pendingMembers.map((member) => {
                      const isBusy = memberActionBusy === member.id;
                      return (
                        <div
                          key={member.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "var(--space-3)",
                            border: "1px solid var(--uikit-slate-200)",
                            borderRadius: "var(--radius-sm)",
                            padding: "var(--space-3)",
                          }}
                        >
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 13 }}>{member.displayName || member.email}</p>
                            <p style={{ marginTop: 2, fontSize: 12, color: "var(--uikit-slate-500)" }}>{member.email}</p>
                          </div>
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <PrimaryButton
                              disabled={isBusy}
                              onClick={() => onDecideJoinRequest(primaryOrg.id, member.id, "ACTIVE")}
                            >
                              {isBusy ? "Đang xử lý…" : "Duyệt"}
                            </PrimaryButton>
                            <GhostButton
                              tone="red"
                              disabled={isBusy}
                              onClick={() => onDecideJoinRequest(primaryOrg.id, member.id, "LEFT")}
                            >
                              Từ chối
                            </GhostButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {primaryOrg.type === "ENTERPRISE" && primaryOrg.status === "ACTIVE" && companyProfile !== undefined && (
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <SectionHeader title="Hồ sơ công ty" />
                  {companyProfile && (
                    <GhostButton onClick={() => setCompanyProfileEditing((v) => !v)}>
                      {companyProfileEditing ? "Đóng" : "Chỉnh sửa"}
                    </GhostButton>
                  )}
                </div>

                {companyProfile && !companyProfileEditing && (
                  <div className="uikit-stack">
                    <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
                      Trang công khai: <code>/organizations/{companyProfile.publicSlug}</code>
                    </p>
                    {companyProfile.industryCode && <p style={{ fontSize: 14 }}>Ngành nghề: {companyProfile.industryCode}</p>}
                    {companyProfile.companySize && <p style={{ fontSize: 14 }}>Quy mô: {companyProfile.companySize}</p>}
                    {companyProfile.description && <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{companyProfile.description}</p>}
                    {!companyProfile.industryCode && !companyProfile.companySize && !companyProfile.description && (
                      <p className="uikit-empty">Chưa có thông tin — bấm &quot;Chỉnh sửa&quot; để bổ sung.</p>
                    )}
                  </div>
                )}

                {(!companyProfile || companyProfileEditing) && (
                  <form
                    onSubmit={(e) => onSaveCompanyProfile(primaryOrg.id, companyProfile ? "update" : "create", e)}
                    className="uikit-stack"
                    style={companyProfile ? { marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--uikit-slate-100)" } : undefined}
                  >
                    {!companyProfile && (
                      <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
                        Hồ sơ công ty giúp tác giả/tổ chức nghiên cứu tìm và đề xuất công nghệ phù hợp với nhu cầu của bạn.
                      </p>
                    )}
                    <TextField
                      label="Ngành nghề"
                      optional
                      value={companyProfileForm.industryCode ?? ""}
                      onChange={(e) => setCompanyProfileForm({ ...companyProfileForm, industryCode: e.target.value })}
                    />
                    <TextField
                      label="Quy mô nhân sự"
                      optional
                      placeholder="VD: 50-200"
                      value={companyProfileForm.companySize ?? ""}
                      onChange={(e) => setCompanyProfileForm({ ...companyProfileForm, companySize: e.target.value })}
                    />
                    <TextField
                      label="Mô tả"
                      as="textarea"
                      optional
                      value={companyProfileForm.description ?? ""}
                      onChange={(e) => setCompanyProfileForm({ ...companyProfileForm, description: e.target.value })}
                    />
                    {companyProfileError && (
                      <p className="uikit-alert-error" role="alert">
                        {companyProfileError}
                      </p>
                    )}
                    <PrimaryButton type="submit" disabled={companyProfileStatus === "loading"}>
                      {companyProfileStatus === "loading" ? "Đang lưu…" : companyProfile ? "Lưu thay đổi" : "Tạo hồ sơ công ty"}
                    </PrimaryButton>
                  </form>
                )}
              </Card>
            )}
            </>
          );
        })()}

        {showAuthorVerification && (
        <Card>
          <SectionHeader title="Xác minh tác giả" />
          {verifyResult ? (
            <div>
              <StatusPill tone={toneOf(VERIFICATION_REQUEST_STATUS_TONE, verifyResult.status)}>
                {VERIFICATION_REQUEST_STATUS_LABELS[verifyResult.status] ?? verifyResult.status}
              </StatusPill>
              <p style={{ marginTop: "var(--space-3)", fontSize: 13, color: "var(--uikit-slate-500)" }}>
                Trạng thái xác minh sẽ được cập nhật qua thông báo khi kiểm định viên xử lý xong.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--uikit-slate-500)", marginBottom: "var(--space-3)" }}>
                Xác minh danh tính tác giả để có thể đăng tài nguyên và tạo technology case.
              </p>
              {!showVerifyForm ? (
                <PrimaryButton onClick={() => setShowVerifyForm(true)}>Gửi yêu cầu xác minh</PrimaryButton>
              ) : (
                <form onSubmit={onSubmitVerification} className="uikit-stack">
                  <SelectField
                    label="Tổ chức công tác"
                    value={verifyForm.affiliationOrgId}
                    onChange={(e) => setVerifyForm({ ...verifyForm, affiliationOrgId: e.target.value })}
                    options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                  />
                  <SelectField
                    label="Loại tài liệu"
                    value={verifyForm.documentType}
                    onChange={(e) => setVerifyForm({ ...verifyForm, documentType: e.target.value })}
                    options={DOCUMENT_TYPE_OPTIONS}
                  />
                  <label className="uikit-field">
                    <span className="uikit-field__label">Tệp tài liệu</span>
                    <input
                      type="file"
                      required
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => setVerifyFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <TextField
                    label="Ghi chú"
                    as="textarea"
                    optional
                    value={verifyForm.submittedNote}
                    onChange={(e) => setVerifyForm({ ...verifyForm, submittedNote: e.target.value })}
                  />
                  {verifyError && (
                    <p className="uikit-alert-error" role="alert">
                      {verifyError}
                    </p>
                  )}
                  <PrimaryButton type="submit" disabled={verifyStatus === "loading" || organizations.length === 0}>
                    {verifyStatus === "loading" ? "Đang gửi…" : "Gửi yêu cầu"}
                  </PrimaryButton>
                </form>
              )}
            </>
          )}
        </Card>
        )}
      </div>
    </Shell>
  );
}
