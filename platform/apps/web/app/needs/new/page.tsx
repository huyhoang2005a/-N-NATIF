"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CreateResearchNeedRequest, MeResponse, OrganizationResponse, ResearchNeedDetailResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS, VISIBILITY_LEVEL_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { BackLink, PrimaryButton, SelectField, Shell, TextField } from "../../../components/ui";

const VISIBILITY_OPTIONS = Object.entries(VISIBILITY_LEVEL_LABELS).map(([value, label]) => ({ value, label }));

export default function NewResearchNeedPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    visibility: "PRIVATE",
    problemStatement: "",
    technicalField: "",
    desiredOutputType: "",
    timeframeMonths: "",
    constraints: "",
    successCriteria: "",
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
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setLoadError("Không tải được thông tin tổ chức.");
      });
  }, [router]);

  const primaryOrg = organizations?.[0];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!primaryOrg) return;
    setStatus("loading");
    setErrorMessage(null);
    try {
      const payload: CreateResearchNeedRequest = {
        companyOrganizationId: primaryOrg.id,
        title: form.title,
        visibility: form.visibility as CreateResearchNeedRequest["visibility"],
        problemStatement: form.problemStatement,
        technicalField: form.technicalField,
        desiredOutputType: form.desiredOutputType,
        timeframeMonths: form.timeframeMonths ? Number(form.timeframeMonths) : undefined,
        constraints: form.constraints || undefined,
        successCriteria: form.successCriteria || undefined,
      };
      const created = await authFetch<ResearchNeedDetailResponse>("/research-needs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/needs/${created.id}`);
    } catch (err) {
      setStatus("error");
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setErrorMessage(err instanceof ApiError ? describeErrorCode(err.code) : "Tạo nhu cầu nghiên cứu thất bại.");
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
      <div style={{ maxWidth: 560 }}>
        <BackLink href="/needs">Quay lại danh sách nhu cầu</BackLink>
        <h1 style={{ fontSize: 22, marginBottom: "var(--space-5)" }}>Đăng nhu cầu nghiên cứu</h1>

        {!primaryOrg ? (
          <p className="uikit-empty">Bạn cần thuộc một tổ chức doanh nghiệp (ENTERPRISE) trước khi đăng nhu cầu.</p>
        ) : (
          <form onSubmit={onSubmit} className="uikit-card uikit-stack">
            <TextField label="Tiêu đề" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <SelectField
              label="Phạm vi hiển thị"
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              options={VISIBILITY_OPTIONS}
            />
            <TextField
              label="Vấn đề cần giải quyết"
              as="textarea"
              required
              hint="Mô tả càng cụ thể càng dễ nhận được đề xuất/gợi ý phù hợp."
              value={form.problemStatement}
              onChange={(e) => setForm({ ...form, problemStatement: e.target.value })}
            />
            <TextField
              label="Lĩnh vực kỹ thuật"
              required
              placeholder="VD: Xử lý nước thải, AI thị giác máy tính..."
              value={form.technicalField}
              onChange={(e) => setForm({ ...form, technicalField: e.target.value })}
            />
            <TextField
              label="Loại kết quả mong muốn"
              required
              placeholder="VD: Prototype, Pilot, Giải pháp trọn gói..."
              value={form.desiredOutputType}
              onChange={(e) => setForm({ ...form, desiredOutputType: e.target.value })}
            />
            <TextField
              label="Thời hạn mong muốn (tháng)"
              type="number"
              min={1}
              optional
              value={form.timeframeMonths}
              onChange={(e) => setForm({ ...form, timeframeMonths: e.target.value })}
            />
            <TextField
              label="Ràng buộc"
              as="textarea"
              optional
              value={form.constraints}
              onChange={(e) => setForm({ ...form, constraints: e.target.value })}
            />
            <TextField
              label="Tiêu chí thành công"
              as="textarea"
              optional
              value={form.successCriteria}
              onChange={(e) => setForm({ ...form, successCriteria: e.target.value })}
            />

            {status === "error" && errorMessage && (
              <p className="uikit-alert-error" role="alert">
                {errorMessage}
              </p>
            )}

            <PrimaryButton type="submit" full disabled={status === "loading"}>
              {status === "loading" ? "Đang tạo…" : "Lưu nháp"}
            </PrimaryButton>
          </form>
        )}
      </div>
    </Shell>
  );
}
