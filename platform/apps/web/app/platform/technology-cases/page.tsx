"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, ChevronRight, FolderOpen, User as UserIcon } from "lucide-react";
import type { MeResponse, OrganizationResponse, TechnologyCaseResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { ORG_TYPE_LABELS, PLATFORM_ROLE_LABELS, TECHNOLOGY_CASE_STATUS_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { fetchUserNames } from "../../../lib/user-lookup";
import { toneOf, TECHNOLOGY_CASE_STATUS_TONE } from "../../../lib/tone";
import { Card, PageLoader, Shell, StatusDot, TextField } from "../../../components/ui";

const PAGE_LIMIT = 100;

interface AuthorGroup {
  userId: string;
  displayName: string;
  cases: TechnologyCaseResponse[];
}

interface OrgGroup {
  organizationId: string;
  organizationName: string;
  organizationType: string;
  authors: AuthorGroup[];
  totalCases: number;
}

async function loadAllCases(): Promise<TechnologyCaseResponse[]> {
  const all: TechnologyCaseResponse[] = [];
  let offset = 0;
  for (;;) {
    const page = await authFetch<TechnologyCaseResponse[]>(`/platform/technology-cases?limit=${PAGE_LIMIT}&offset=${offset}`);
    all.push(...page);
    if (page.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }
  return all;
}

function buildTree(cases: TechnologyCaseResponse[], orgNames: Record<string, OrganizationResponse>, userNames: Record<string, string>): OrgGroup[] {
  const orgMap = new Map<string, Map<string, TechnologyCaseResponse[]>>();
  for (const c of cases) {
    if (!orgMap.has(c.owningOrganizationId)) orgMap.set(c.owningOrganizationId, new Map());
    const authorMap = orgMap.get(c.owningOrganizationId)!;
    if (!authorMap.has(c.createdByUserId)) authorMap.set(c.createdByUserId, []);
    authorMap.get(c.createdByUserId)!.push(c);
  }

  const groups: OrgGroup[] = [];
  for (const [orgId, authorMap] of orgMap) {
    const authors: AuthorGroup[] = [];
    for (const [userId, orgCases] of authorMap) {
      orgCases.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      authors.push({ userId, displayName: userNames[userId] ?? userId.slice(0, 8), cases: orgCases });
    }
    authors.sort((a, b) => b.cases.length - a.cases.length);
    groups.push({
      organizationId: orgId,
      organizationName: orgNames[orgId]?.name ?? orgId.slice(0, 8),
      organizationType: orgNames[orgId]?.type ?? "",
      authors,
      totalCases: authors.reduce((sum, a) => sum + a.cases.length, 0),
    });
  }
  groups.sort((a, b) => b.totalCases - a.totalCases);
  return groups;
}

export default function AdminTechnologyCasesArchivePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tree, setTree] = useState<OrgGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openOrgs, setOpenOrgs] = useState<Set<string>>(new Set());
  const [openAuthors, setOpenAuthors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    authFetch<MeResponse>("/me")
      .then(async (meResponse) => {
        if (meResponse.platformRole !== "PLATFORM_ADMIN") {
          router.push("/dashboard");
          return;
        }
        setMe(meResponse);

        const cases = await loadAllCases();
        const uniqueOrgIds = Array.from(new Set(cases.map((c) => c.owningOrganizationId)));
        const uniqueUserIds = Array.from(new Set(cases.map((c) => c.createdByUserId)));

        const [orgRows, userNames] = await Promise.all([
          Promise.all(uniqueOrgIds.map((id) => authFetch<OrganizationResponse>(`/organizations/${id}`))),
          fetchUserNames(uniqueUserIds),
        ]);
        const orgNames = Object.fromEntries(orgRows.map((o) => [o.id, o]));

        const built = buildTree(cases, orgNames, userNames);
        setTree(built);
        // First org open by default so the page doesn't look empty on load.
        setOpenOrgs(new Set(built.slice(0, 1).map((g) => g.organizationId)));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được kho lưu trữ case.");
      });
    // Intentionally runs once on mount.
  }, []);

  const filteredTree = useMemo(() => {
    if (!tree) return null;
    const q = search.trim().toLowerCase();
    if (!q) return tree;
    return tree
      .map((org) => {
        const matchesOrg = org.organizationName.toLowerCase().includes(q);
        const authors = org.authors
          .map((author) => {
            const matchesAuthor = author.displayName.toLowerCase().includes(q);
            const cases = matchesOrg || matchesAuthor ? author.cases : author.cases.filter((c) => c.title.toLowerCase().includes(q));
            return cases.length > 0 ? { ...author, cases } : null;
          })
          .filter((a): a is AuthorGroup => a !== null);
        return authors.length > 0 ? { ...org, authors, totalCases: authors.reduce((s, a) => s + a.cases.length, 0) } : null;
      })
      .filter((g): g is OrgGroup => g !== null);
  }, [tree, search]);

  if (!me) return <PageLoader />;
  const nav = navForPersona("platform-ops", true);

  if (!filteredTree && !error) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
        <PageLoader inline />
      </Shell>
    );
  }

  const totalOrgs = tree?.length ?? 0;
  const totalAuthors = tree?.reduce((s, g) => s + g.authors.length, 0) ?? 0;
  const totalCases = tree?.reduce((s, g) => s + g.totalCases, 0) ?? 0;

  function toggleOrg(id: string) {
    setOpenOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAuthor(key: string) {
    setOpenAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isFiltering = search.trim().length > 0;

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <div>
          <h1 style={{ fontSize: 22 }}>Kho lưu trữ case</h1>
          <p style={{ marginTop: "var(--space-1)", fontSize: 14, color: "var(--uikit-slate-500)" }}>
            Toàn bộ case công nghệ trên nền tảng, phân theo tổ chức chủ trì rồi đến tác giả tạo case.
          </p>
        </div>

        <div className="uikit-card-grid uikit-card-grid--3">
          <Card>
            <p style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>Tổ chức có case</p>
            <p style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{totalOrgs}</p>
          </Card>
          <Card>
            <p style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>Tác giả đã tạo case</p>
            <p style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{totalAuthors}</p>
          </Card>
          <Card>
            <p style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>Tổng số case</p>
            <p style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{totalCases}</p>
          </Card>
        </div>

        <div style={{ maxWidth: 420 }}>
          <TextField
            label="Tìm theo tổ chức, tác giả hoặc tên case"
            optional
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="vd: Viện Công nghệ, Nguyễn Văn A…"
          />
        </div>

        {error && (
          <p className="uikit-alert-error" role="alert">
            {error}
          </p>
        )}

        <Card>
          {filteredTree && filteredTree.length === 0 ? (
            <p className="uikit-empty">{isFiltering ? "Không tìm thấy kết quả phù hợp." : "Chưa có case nào trên nền tảng."}</p>
          ) : (
            <div className="uikit-stack" style={{ gap: "var(--space-2)" }}>
              {filteredTree?.map((org) => {
                const orgOpen = isFiltering || openOrgs.has(org.organizationId);
                return (
                  <div key={org.organizationId}>
                    <button
                      type="button"
                      onClick={() => toggleOrg(org.organizationId)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        width: "100%",
                        textAlign: "left",
                        background: "var(--uikit-slate-50)",
                        border: "1px solid var(--uikit-slate-200)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--space-3)",
                        cursor: "pointer",
                      }}
                    >
                      {orgOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <Building2 size={16} style={{ color: "var(--uikit-indigo-700)" }} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{org.organizationName}</span>
                      {org.organizationType && (
                        <span style={{ fontSize: 12, color: "var(--uikit-slate-400)" }}>
                          {ORG_TYPE_LABELS[org.organizationType as keyof typeof ORG_TYPE_LABELS] ?? org.organizationType}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--uikit-slate-500)" }}>
                        {org.authors.length} tác giả · {org.totalCases} case
                      </span>
                    </button>

                    {orgOpen && (
                      <div style={{ paddingLeft: "var(--space-6)", marginTop: "var(--space-2)" }} className="uikit-stack" >
                        {org.authors.map((author) => {
                          const authorKey = `${org.organizationId}:${author.userId}`;
                          const authorOpen = isFiltering || openAuthors.has(authorKey);
                          return (
                            <div key={authorKey}>
                              <button
                                type="button"
                                onClick={() => toggleAuthor(authorKey)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "var(--space-2)",
                                  width: "100%",
                                  textAlign: "left",
                                  background: "none",
                                  border: "none",
                                  padding: "var(--space-2) 0",
                                  cursor: "pointer",
                                }}
                              >
                                {authorOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <UserIcon size={14} style={{ color: "var(--uikit-slate-500)" }} />
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{author.displayName}</span>
                                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--uikit-slate-400)" }}>{author.cases.length} case</span>
                              </button>

                              {authorOpen && (
                                <div style={{ paddingLeft: "var(--space-6)" }} className="uikit-stack">
                                  {author.cases.map((c) => (
                                    <Link
                                      key={c.id}
                                      href={`/technology-cases/${c.id}`}
                                      className="uikit-row-link"
                                      style={{ padding: "var(--space-2) var(--space-3)" }}
                                    >
                                      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13 }}>
                                        <FolderOpen size={14} style={{ color: "var(--uikit-slate-400)" }} />
                                        {c.title}
                                      </span>
                                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                                        <span style={{ fontSize: 11, color: "var(--uikit-slate-400)" }}>
                                          {new Date(c.updatedAt).toLocaleDateString("vi-VN")}
                                        </span>
                                        <StatusDot
                                          tone={toneOf(TECHNOLOGY_CASE_STATUS_TONE, c.lifecycleStatus)}
                                          label={TECHNOLOGY_CASE_STATUS_LABELS[c.lifecycleStatus] ?? c.lifecycleStatus}
                                        />
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
