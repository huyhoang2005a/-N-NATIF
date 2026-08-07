"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, UserPlus } from "lucide-react";
import type {
  AuthorVerificationRequestResponse,
  AuthorVerificationUploadResponse,
  MeResponse,
  OrganizationMemberResponse,
  OrganizationResponse,
  UpdateProfileRequest,
  UserProfileResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS, PLATFORM_ROLE_LABELS, VERIFICATION_REQUEST_STATUS_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { toneOf, ORGANIZATION_STATUS_TONE, VERIFICATION_REQUEST_STATUS_TONE } from "../../lib/tone";
import { Card, GhostButton, PrimaryButton, SectionHeader, SelectField, Shell, StatusPill, TextField } from "../../components/ui";

const DOCUMENT_TYPE_OPTIONS = [
  { value: "IDENTITY_DOCUMENT", label: "Giấy tờ tuỳ thân" },
  { value: "AFFILIATION_PROOF", label: "Minh chứng đơn vị công tác" },
  { value: "ORGANIZATION_LETTER", label: "Thư xác nhận của tổ chức" },
  { value: "TAX_DOCUMENT", label: "Giấy tờ thuế" },
  { value: "OTHER", label: "Khác" },
];

const INVITE_ROLE_OPTIONS = [
  { value: "MEMBER", label: "Thành viên" },
  { value: "ORG_ADMIN", label: "Quản trị viên tổ chức" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateProfileRequest>({});
  const [editStatus, setEditStatus] = useState<"idle" | "loading" | "error">("idle");
  const [editError, setEditError] = useState<string | null>(null);

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
    ])
      .then(([meResponse, profileResponse, orgs]) => {
        setMe(meResponse);
        setProfile(profileResponse);
        setOrganizations(orgs);
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
  const [resubmitted, setResubmitted] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "MEMBER" });
  const [inviteResult, setInviteResult] = useState<OrganizationMemberResponse | null>(null);

  function onResubmitVerification(organizationId: string) {
    setOrgActionBusy("resubmit");
    setOrgActionError(null);
    authFetch(`/organizations/${organizationId}/verification-requests`, { method: "POST" })
      .then(() => setResubmitted(true))
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setOrgActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Nộp lại hồ sơ thất bại.");
      })
      .finally(() => setOrgActionBusy(null));
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
    return null;
  }

  const roleLabel = PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole;

  if (!profile || !organizations) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={navForPersona(personaOf(me, []), false)}>
        {null}
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

        {organizations.length > 0 && (() => {
          const primaryOrg = organizations[0]!;
          return (
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

              {primaryOrg.status === "REJECTED" && (
                <div style={{ marginTop: "var(--space-4)" }}>
                  {resubmitted ? (
                    <StatusPill tone="amber">Đã nộp lại — chờ kiểm định viên duyệt</StatusPill>
                  ) : (
                    <GhostButton icon={RefreshCw} disabled={orgActionBusy === "resubmit"} onClick={() => onResubmitVerification(primaryOrg.id)}>
                      {orgActionBusy === "resubmit" ? "Đang nộp…" : "Nộp lại hồ sơ xác minh"}
                    </GhostButton>
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
