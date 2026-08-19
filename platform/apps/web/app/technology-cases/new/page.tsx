"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  CreateEvidenceRequest,
  EvidenceResponse,
  MeResponse,
  OrganizationResponse,
  RegisterTechnologyCaseRequest,
  ResourceResponse,
  ResourceVersionResponse,
  TechnologyCaseResponse,
} from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { AuthorVerificationGate, BackLink, Card, GhostButton, PageLoader, PrimaryButton, SectionHeader, SelectField, Shell, TextField } from "../../../components/ui";

export default function NewTechnologyCasePage() {
  return (
    <Suspense fallback={null}>
      <NewTechnologyCasePageInner />
    </Suspense>
  );
}

function NewTechnologyCasePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "Tạo case công nghệ từ tài liệu này" (apps/web/app/resources/[id]/page.tsx) navigates
  // here with `?fromResourceId=<id>` — when present, on successful case creation we offer
  // an inline "attach this resource as first evidence" step reusing the existing evidence
  // endpoint (POST /technology-cases/:id/evidence), instead of inventing a new
  // request-tracking entity (explicit decision, see plan).
  const fromResourceId = searchParams.get("fromResourceId");

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

  const [sourceResource, setSourceResource] = useState<ResourceResponse | null>(null);
  const [sourceVersion, setSourceVersion] = useState<ResourceVersionResponse | null>(null);

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

  // Separate effect: pre-fill from the source resource when navigated here via "Tạo case
  // công nghệ từ tài liệu này". Failures here are non-fatal — the case-creation form still
  // works standalone, it just won't offer the evidence step.
  useEffect(() => {
    if (!fromResourceId) return;
    authFetch<ResourceResponse>(`/resources/${fromResourceId}`)
      .then((resource) => {
        setSourceResource(resource);
        setForm((f) => ({ ...f, title: f.title || `Case công nghệ: ${resource.title}` }));
        return authFetch<ResourceVersionResponse[]>(`/resources/${fromResourceId}/versions`);
      })
      .then((versions) => {
        const published = versions?.find((v) => v.status === "PUBLISHED") ?? null;
        setSourceVersion(published);
      })
      .catch(() => {
        // Resource not visible / no versions — silently skip the evidence step.
      });
  }, [fromResourceId]);

  const [createdCase, setCreatedCase] = useState<TechnologyCaseResponse | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({ title: "", claim: "", relevanceNote: "", snippet: "" });
  const [evidenceStatus, setEvidenceStatus] = useState<"idle" | "loading" | "error">("idle");
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

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
      if (sourceResource && sourceVersion) {
        // Offer the evidence-attach step instead of redirecting immediately — pre-filled,
        // but the user reviews/edits before anything is actually submitted (no silent
        // auto-submit of placeholder evidence text).
        setEvidenceForm({
          title: sourceResource.title,
          claim: `Tài liệu "${sourceResource.title}" cung cấp cơ sở khoa học/kỹ thuật liên quan cho case công nghệ này.`,
          relevanceNote: "Được thêm từ luồng \"Tạo case công nghệ từ tài liệu này\" trên trang tài nguyên.",
          snippet: (sourceResource.description || sourceResource.title).slice(0, 300),
        });
        setCreatedCase(created);
        setStatus("idle");
      } else {
        router.push(`/technology-cases/${created.id}`);
      }
    } catch (err) {
      setStatus("error");
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setErrorMessage(err instanceof ApiError ? describeErrorCode(err.code) : "Tạo case thất bại.");
    }
  }

  async function onAddEvidence() {
    if (!createdCase || !sourceVersion) return;
    setEvidenceStatus("loading");
    setEvidenceError(null);
    try {
      const payload: CreateEvidenceRequest = {
        resourceVersionId: sourceVersion.id,
        title: evidenceForm.title,
        claim: evidenceForm.claim,
        relevanceNote: evidenceForm.relevanceNote,
        citation: { snippet: evidenceForm.snippet },
      };
      await authFetch<EvidenceResponse>(`/technology-cases/${createdCase.id}/evidence`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/technology-cases/${createdCase.id}`);
    } catch (err) {
      setEvidenceStatus("error");
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setEvidenceError(err instanceof ApiError ? describeErrorCode(err.code) : "Thêm bằng chứng thất bại.");
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

        {createdCase ? (
          <Card className="uikit-stack">
            <SectionHeader title="Thêm bằng chứng đầu tiên" />
            <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
              Case &quot;{createdCase.title}&quot; đã được tạo. Xem lại và chỉnh sửa bằng chứng dưới đây trước khi
              gắn vào case — dựa trên tài liệu bạn chọn từ bảng tin.
            </p>
            <TextField
              label="Tiêu đề bằng chứng"
              required
              value={evidenceForm.title}
              onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })}
            />
            <TextField
              label="Nhận định (claim)"
              as="textarea"
              required
              value={evidenceForm.claim}
              onChange={(e) => setEvidenceForm({ ...evidenceForm, claim: e.target.value })}
            />
            <TextField
              label="Ghi chú liên quan (relevance note)"
              as="textarea"
              required
              value={evidenceForm.relevanceNote}
              onChange={(e) => setEvidenceForm({ ...evidenceForm, relevanceNote: e.target.value })}
            />
            <TextField
              label="Đoạn trích dẫn (citation)"
              as="textarea"
              required
              value={evidenceForm.snippet}
              onChange={(e) => setEvidenceForm({ ...evidenceForm, snippet: e.target.value })}
            />
            {evidenceStatus === "error" && evidenceError && (
              <p className="uikit-alert-error" role="alert">
                {evidenceError}
              </p>
            )}
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <PrimaryButton
                disabled={
                  evidenceStatus === "loading" ||
                  !evidenceForm.title.trim() ||
                  !evidenceForm.claim.trim() ||
                  !evidenceForm.relevanceNote.trim() ||
                  !evidenceForm.snippet.trim()
                }
                onClick={onAddEvidence}
              >
                {evidenceStatus === "loading" ? "Đang thêm…" : "Thêm bằng chứng & Xem case"}
              </PrimaryButton>
              <GhostButton disabled={evidenceStatus === "loading"} onClick={() => router.push(`/technology-cases/${createdCase.id}`)}>
                Bỏ qua, xem case
              </GhostButton>
            </div>
          </Card>
        ) : me.authorVerificationStatus !== "VERIFIED" ? (
          <AuthorVerificationGate message="Bạn cần là tác giả đã xác minh mới tạo được case. Gửi yêu cầu xác minh ở trang Hồ sơ." />
        ) : organizations.length === 0 ? (
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
