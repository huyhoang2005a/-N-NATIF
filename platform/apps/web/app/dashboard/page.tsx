"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  Database,
  Flag,
  FolderOpen,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import type {
  AuthorVerificationRequestResponse,
  ContentFlagResponse,
  MeResponse,
  OrganizationResponse,
  OrganizationVerificationRequestResponse,
  ReadinessAssessmentResponse,
  ResourceResponse,
  RoadmapResponse,
  TechnologyCaseResponse,
} from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS, TECHNOLOGY_CASE_STATUS_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { toneOf, ORGANIZATION_STATUS_TONE, TECHNOLOGY_CASE_STATUS_TONE } from "../../lib/tone";
import { Card, SectionHeader, Shell, StatCard, StatusDot, StatusPill } from "../../components/ui";

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError("Không tải được dữ liệu bảng điều khiển.");
      });
  }, [router]);

  if (error) {
    return (
      <div className="uikit-main" style={{ maxWidth: 720, margin: "0 auto" }}>
        <p className="uikit-alert-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!me || !organizations) return null;

  const persona = personaOf(me, organizations);
  const isAdmin = me.platformRole === "PLATFORM_ADMIN";
  const nav = navForPersona(persona, isAdmin);
  const roleLabel = PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole;

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
      {persona === "author" && <AuthorDashboardBody me={me} organizations={organizations} />}
      {persona === "company" && <CompanyDashboardBody me={me} organizations={organizations} />}
      {persona === "platform-ops" && <PlatformOpsDashboardBody isAdmin={isAdmin} />}
    </Shell>
  );
}

function AuthorDashboardBody({ me, organizations }: { me: MeResponse; organizations: OrganizationResponse[] }) {
  const [cases, setCases] = useState<TechnologyCaseResponse[] | null>(null);
  const [resources, setResources] = useState<ResourceResponse[] | null>(null);

  useEffect(() => {
    Promise.all([
      authFetch<TechnologyCaseResponse[]>("/technology-cases"),
      authFetch<ResourceResponse[]>("/resources"),
    ]).then(([caseRows, resourceRows]) => {
      setCases(caseRows);
      setResources(resourceRows.filter((r) => r.createdByUserId === me.userId));
    });
  }, [me.userId]);

  if (!cases || !resources) return null;

  const primaryOrg = organizations[0];
  const recentCases = cases.slice(0, 5);
  const recentResources = resources.slice(0, 3);

  return (
    <div className="uikit-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Không gian nghiên cứu</h1>
          <p style={{ marginTop: "var(--space-1)", fontSize: 14, color: "var(--uikit-slate-500)" }}>
            Xin chào, {me.displayName}
          </p>
        </div>
        {primaryOrg && (
          <StatusPill tone={toneOf(ORGANIZATION_STATUS_TONE, primaryOrg.status)}>{primaryOrg.name}</StatusPill>
        )}
      </div>

      <div className="uikit-card-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <StatCard label="Case đang theo dõi" value={cases.length} icon={FolderOpen} tone="indigo" />
        <StatCard label="Tài nguyên đã đăng" value={resources.length} icon={Database} tone="slate" />
        <SoonStatTile label="Đề xuất chờ phản hồi" icon={Send} />
      </div>

      <Card>
        <SectionHeader title="Case của tôi" action="Xem tất cả" href="/technology-cases" />
        {recentCases.length === 0 ? (
          <p className="uikit-empty">
            Chưa có case nào. Tạo case đầu tiên để bắt đầu theo dõi quá trình đánh giá và lộ
            trình thương mại hoá công nghệ của bạn.
          </p>
        ) : (
          <div className="uikit-row-list">
            {recentCases.map((c) => (
              <Link key={c.id} href={`/technology-cases/${c.id}`} className="uikit-row-link">
                <span style={{ fontSize: 14, fontWeight: 500 }}>{c.title}</span>
                <StatusDot
                  tone={toneOf(TECHNOLOGY_CASE_STATUS_TONE, c.lifecycleStatus)}
                  label={TECHNOLOGY_CASE_STATUS_LABELS[c.lifecycleStatus] ?? c.lifecycleStatus}
                />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Tài nguyên gần đây" action="Đăng tài nguyên mới" href="/resources/new" />
        {recentResources.length === 0 ? (
          <p className="uikit-empty">
            Chưa có tài nguyên nào. Đăng bài báo, bộ dữ liệu hoặc kết quả thực nghiệm đầu tiên
            để làm cơ sở bằng chứng cho các case sau này.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
            {recentResources.map((r) => (
              <div key={r.id} style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--uikit-slate-900)" }}>{r.title}</p>
                <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--uikit-slate-400)" }}>
                  {r.type}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {organizations.length === 0 && (
        <Card>
          <p className="uikit-empty">Bạn chưa là thành viên của tổ chức nào.</p>
        </Card>
      )}
    </div>
  );
}

function CompanyDashboardBody({ me, organizations }: { me: MeResponse; organizations: OrganizationResponse[] }) {
  const [cases, setCases] = useState<TechnologyCaseResponse[] | null>(null);

  useEffect(() => {
    authFetch<TechnologyCaseResponse[]>("/technology-cases").then(setCases);
  }, []);

  if (!cases) return null;

  const primaryOrg = organizations[0];

  return (
    <div className="uikit-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Khám phá công nghệ</h1>
          <p style={{ marginTop: "var(--space-1)", fontSize: 14, color: "var(--uikit-slate-500)" }}>
            {primaryOrg?.name ?? me.displayName}
          </p>
        </div>
      </div>

      <div className="uikit-card-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <SoonStatTile label="Nhu cầu đang mở" icon={Target} />
        <SoonStatTile label="Gợi ý công nghệ mới" icon={Sparkles} />
        <StatCard label="Case đang hợp tác" value={cases.length} icon={FolderOpen} tone="slate" />
      </div>

      <Card>
        <SectionHeader title="Gợi ý công nghệ mới nhất" />
        <div className="uikit-soon">
          <p className="uikit-soon__title">Sắp ra mắt</p>
          <p>Gợi ý công nghệ theo nhu cầu doanh nghiệp đang được phát triển (Phase 5).</p>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Case đang hợp tác" action="Xem tất cả" href="/technology-cases" />
        {cases.length === 0 ? (
          <p className="uikit-empty">
            Chưa có case hợp tác nào. Khi tổ chức của bạn được liên kết vào một technology case
            (với vai trò đối tác), case đó sẽ hiện ở đây.
          </p>
        ) : (
          <div className="uikit-row-list">
            {cases.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/technology-cases/${c.id}`} className="uikit-row-link">
                <span style={{ fontSize: 14, fontWeight: 500 }}>{c.title}</span>
                <StatusDot
                  tone={toneOf(TECHNOLOGY_CASE_STATUS_TONE, c.lifecycleStatus)}
                  label={TECHNOLOGY_CASE_STATUS_LABELS[c.lifecycleStatus] ?? c.lifecycleStatus}
                />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

interface ReviewQueueItem {
  caseId: string;
  caseTitle: string;
  kind: "assessment" | "roadmap";
  id: string;
  label: string;
}

function PlatformOpsDashboardBody({ isAdmin }: { isAdmin: boolean }) {
  const [orgVerifications, setOrgVerifications] = useState<OrganizationVerificationRequestResponse[] | null>(null);
  const [authorVerifications, setAuthorVerifications] = useState<AuthorVerificationRequestResponse[] | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[] | null>(null);
  const [contentFlags, setContentFlags] = useState<ContentFlagResponse[] | null>(null);

  useEffect(() => {
    Promise.all([
      authFetch<OrganizationVerificationRequestResponse[]>("/platform/organization-verifications"),
      authFetch<AuthorVerificationRequestResponse[]>("/platform/author-verifications"),
      authFetch<TechnologyCaseResponse[]>("/technology-cases"),
      authFetch<ContentFlagResponse[]>("/platform/content-flags"),
    ]).then(async ([orgReqs, authorReqs, cases, flags]) => {
      setOrgVerifications(orgReqs);
      setAuthorVerifications(authorReqs);
      setContentFlags(flags);

      const items: ReviewQueueItem[] = [];
      await Promise.all(
        cases.map(async (c) => {
          const [assessments, roadmaps] = await Promise.all([
            authFetch<ReadinessAssessmentResponse[]>(`/technology-cases/${c.id}/assessments`),
            authFetch<RoadmapResponse[]>(`/technology-cases/${c.id}/roadmaps`),
          ]);
          for (const a of assessments) {
            if (a.status === "SUBMITTED") {
              items.push({ caseId: c.id, caseTitle: c.title, kind: "assessment", id: a.id, label: "Đánh giá mức độ sẵn sàng" });
            }
          }
          for (const r of roadmaps) {
            if (r.status === "IN_REVIEW") {
              items.push({ caseId: c.id, caseTitle: c.title, kind: "roadmap", id: r.id, label: "Lộ trình thương mại hoá" });
            }
          }
        }),
      );
      setReviewQueue(items);
    });
  }, []);

  if (!orgVerifications || !authorVerifications || !reviewQueue || !contentFlags) return null;

  const pendingOrg = orgVerifications.filter((r) => r.status === "PENDING");
  const pendingAuthor = authorVerifications.filter((r) => r.status === "PENDING");
  const recentOrg = orgVerifications.slice(0, 3);
  const openFlags = contentFlags.filter((f) => f.status === "PENDING" || f.status === "IN_REVIEW");

  return (
    <div className="uikit-stack">
      <div>
        <h1 style={{ fontSize: 22 }}>{isAdmin ? "Bảng điều khiển nền tảng" : "Hàng chờ kiểm định"}</h1>
        <p style={{ marginTop: "var(--space-1)", fontSize: 14, color: "var(--uikit-slate-500)" }}>
          {isAdmin ? "Quản trị viên" : "Kiểm định viên"}
        </p>
      </div>

      <div className="uikit-card-grid" style={{ gridTemplateColumns: `repeat(${isAdmin ? 4 : 3}, 1fr)` }}>
        {isAdmin && <SoonStatTile label="Tổ chức hoạt động" icon={Building2} />}
        {isAdmin && <SoonStatTile label="Case đang xử lý" icon={FolderOpen} />}
        <StatCard label="Chờ xác minh" value={pendingOrg.length + pendingAuthor.length} icon={ShieldCheck} tone="amber" />
        <StatCard label="Đánh giá & lộ trình chờ duyệt" value={reviewQueue.length} icon={ClipboardCheck} tone="indigo" />
        <Link href="/platform/flags" style={{ textDecoration: "none", color: "inherit" }}>
          <StatCard label="Nội dung bị gắn cờ" value={openFlags.length} icon={Flag} tone="rose" />
        </Link>
      </div>

      <Card>
        <SectionHeader title="Yêu cầu xác minh tổ chức gần nhất" action="Xem tất cả" href="/platform/organization-verifications" />
        {recentOrg.length === 0 ? (
          <p className="uikit-empty">Không có yêu cầu xác minh tổ chức nào đang chờ xử lý.</p>
        ) : (
          <div className="uikit-row-list">
            {recentOrg.map((r) => (
              <div key={r.id} className="uikit-row">
                <span style={{ fontSize: 14 }}>Tổ chức {r.organizationId.slice(0, 8)}</span>
                <StatusDot tone="blue" label="Chờ duyệt" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Đánh giá & lộ trình chờ duyệt" action="Xem tất cả" href="/platform/reviews" />
        {reviewQueue.length === 0 ? (
          <p className="uikit-empty">Không có đánh giá hoặc lộ trình nào đang chờ duyệt.</p>
        ) : (
          <div className="uikit-row-list">
            {reviewQueue.slice(0, 3).map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.kind === "assessment" ? `/assessments/${item.id}` : `/roadmaps/${item.id}`}
                className="uikit-row-link"
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{item.caseTitle}</p>
                  <p style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>{item.label}</p>
                </div>
                <StatusDot tone="blue" label="Chờ duyệt" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SoonStatTile({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div className="uikit-card uikit-statcard" style={{ opacity: 0.6 }}>
      <div className="uikit-statcard__icon uikit-statcard__icon--amber">
        <Icon aria-hidden="true" />
      </div>
      <div>
        <p className="uikit-statcard__value">—</p>
        <p className="uikit-statcard__label">{label}</p>
        <p className="uikit-statcard__hint">Sắp ra mắt</p>
      </div>
    </div>
  );
}
