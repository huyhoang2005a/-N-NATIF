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
} from "lucide-react";
import type {
  AuthorVerificationRequestResponse,
  ContentFlagResponse,
  MeResponse,
  OrganizationResponse,
  OrganizationVerificationRequestResponse,
  PlatformCaseSummaryResponse,
  ReadinessAssessmentResponse,
  RecommendationItemResponse,
  ResearchNeedResponse,
  ResearchProposalResponse,
  ResourceResponse,
  RoadmapResponse,
  TechnologyCaseResponse,
} from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS, TECHNOLOGY_CASE_STATUS_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { toneOf, ORGANIZATION_STATUS_TONE, TECHNOLOGY_CASE_STATUS_TONE } from "../../lib/tone";
import { Card, MatchScoreBadge, PageLoader, SectionHeader, Shell, StatCard, StatusDot, StatusPill } from "../../components/ui";

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

  if (!me || !organizations) return <PageLoader />;
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
  const [proposals, setProposals] = useState<ResearchProposalResponse[] | null>(null);

  useEffect(() => {
    Promise.all([
      authFetch<TechnologyCaseResponse[]>("/technology-cases"),
      authFetch<ResourceResponse[]>("/resources"),
      authFetch<ResearchProposalResponse[]>("/proposals"),
    ]).then(([caseRows, resourceRows, proposalRows]) => {
      setCases(caseRows);
      setResources(resourceRows.filter((r) => r.createdByUserId === me.userId));
      setProposals(proposalRows);
    });
  }, [me.userId]);

  if (!cases || !resources || !proposals) return <PageLoader />;
  const primaryOrg = organizations[0];
  const recentCases = cases.slice(0, 5);
  const recentResources = resources.slice(0, 3);
  const pendingProposalsCount = proposals.filter((p) => p.status === "SUBMITTED" || p.status === "UNDER_REVIEW").length;

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

      <div className="uikit-card-grid uikit-card-grid--3">
        <StatCard label="Case đang theo dõi" value={cases.length} icon={FolderOpen} tone="indigo" />
        <StatCard label="Tài nguyên đã đăng" value={resources.length} icon={Database} tone="slate" />
        <StatCard href="/proposals" label="Đề xuất chờ phản hồi" value={pendingProposalsCount} icon={Send} tone="amber" />
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
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
  const [needs, setNeeds] = useState<ResearchNeedResponse[] | null>(null);
  const [recommendationItems, setRecommendationItems] = useState<RecommendationItemResponse[] | null>(null);

  useEffect(() => {
    authFetch<TechnologyCaseResponse[]>("/technology-cases").then(setCases);
    const primaryOrg = organizations[0];
    if (!primaryOrg) {
      setNeeds([]);
      setRecommendationItems([]);
      return;
    }
    authFetch<ResearchNeedResponse[]>(`/organizations/${primaryOrg.id}/research-needs`)
      .then(setNeeds)
      .catch(() => setNeeds([]));
    if (primaryOrg.type === "ENTERPRISE" && primaryOrg.status === "ACTIVE") {
      authFetch<RecommendationItemResponse[]>(`/organizations/${primaryOrg.id}/company-profile/feed`)
        .then(setRecommendationItems)
        .catch(() => setRecommendationItems([]));
    } else {
      setRecommendationItems([]);
    }
    // Intentionally runs once on mount — `organizations` is a stable prop from the parent.
  }, []);

  if (!cases || !needs || !recommendationItems) return <PageLoader />;
  const primaryOrg = organizations[0];
  const openNeedsCount = needs.filter((n) => n.status === "OPEN").length;
  const activeRecommendations = recommendationItems.filter((i) => i.status === "ACTIVE");

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

      <div className="uikit-card-grid uikit-card-grid--3">
        <StatCard href="/needs" label="Nhu cầu đang mở" value={openNeedsCount} icon={Target} tone="indigo" />
        <StatCard href="/recommendations" label="Gợi ý công nghệ mới" value={activeRecommendations.length} icon={Sparkles} tone="slate" />
        <StatCard label="Case đang hợp tác" value={cases.length} icon={FolderOpen} tone="slate" />
      </div>

      <Card>
        <SectionHeader title="Gợi ý công nghệ mới nhất" action="Xem tất cả" href="/recommendations" />
        {activeRecommendations.length === 0 ? (
          <p className="uikit-empty">
            {primaryOrg?.type === "ENTERPRISE" && primaryOrg.status === "ACTIVE"
              ? "Chưa có gợi ý nào — bấm \"Làm mới gợi ý\" trên trang Gợi ý công nghệ để chạy lần đầu."
              : "Cần hồ sơ công ty đang hoạt động (tổ chức ENTERPRISE đã kích hoạt) để nhận gợi ý công nghệ."}
          </p>
        ) : (
          <div className="uikit-row-list">
            {activeRecommendations.slice(0, 3).map((item) => (
              <Link key={item.id} href="/recommendations" className="uikit-row-link">
                <span style={{ fontSize: 14, fontWeight: 500 }}>{item.resourceTitle}</span>
                <MatchScoreBadge score={item.matchScore} />
              </Link>
            ))}
          </div>
        )}
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
  const [activeOrgCount, setActiveOrgCount] = useState<number | null>(null);
  const [caseSummary, setCaseSummary] = useState<PlatformCaseSummaryResponse | null>(null);

  useEffect(() => {
    if (isAdmin) {
      authFetch<OrganizationResponse[]>("/platform/organizations?limit=100")
        .then((rows) => setActiveOrgCount(rows.filter((o) => o.status === "ACTIVE").length))
        .catch(() => setActiveOrgCount(0));
      authFetch<PlatformCaseSummaryResponse>("/platform/technology-cases/summary")
        .then(setCaseSummary)
        .catch(() => setCaseSummary({ total: 0, active: 0 }));
    }
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

  if (!orgVerifications || !authorVerifications || !reviewQueue || !contentFlags) return <PageLoader />;
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

      <div className={`uikit-card-grid ${isAdmin ? "uikit-card-grid--4" : "uikit-card-grid--3"}`}>
        {isAdmin && <StatCard href="/platform/organizations" label="Tổ chức hoạt động" value={activeOrgCount ?? "—"} icon={Building2} tone="indigo" />}
        {isAdmin && <StatCard label="Case đang xử lý" value={caseSummary?.active ?? "—"} icon={FolderOpen} tone="slate" hint={caseSummary ? `${caseSummary.total} tổng` : undefined} />}
        <StatCard label="Chờ xác minh" value={pendingOrg.length + pendingAuthor.length} icon={ShieldCheck} tone="amber" />
        <StatCard label="Đánh giá & lộ trình chờ duyệt" value={reviewQueue.length} icon={ClipboardCheck} tone="indigo" />
        <StatCard href="/platform/flags" label="Nội dung bị gắn cờ" value={openFlags.length} icon={Flag} tone="rose" />
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
