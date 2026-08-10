"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import type { MeResponse, OrganizationResponse, ResourceResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS, RESOURCE_ACCESS_LEVEL_LABELS, RESOURCE_TYPE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { Card, PrimaryButtonLink, SaveButton, Shell, Tabs, VoteButton } from "../../components/ui";

const SORT_TABS = ["Mới nhất", "Điểm cao nhất", "Thịnh hành"] as const;
const SORT_TAB_TO_VALUE: Record<(typeof SORT_TABS)[number], "new" | "top" | "hot"> = {
  "Mới nhất": "new",
  "Điểm cao nhất": "top",
  "Thịnh hành": "hot",
};

export default function ResourcesPage() {
  return (
    <Suspense fallback={null}>
      <ResourcesPageInner />
    </Suspense>
  );
}

function ResourcesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [resources, setResources] = useState<ResourceResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortTab, setSortTab] = useState<(typeof SORT_TABS)[number]>("Mới nhất");

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    const sort = SORT_TAB_TO_VALUE[sortTab];
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (q) params.set("sort", sort);
    const resourcePath = params.toString() ? `/resources?${params.toString()}` : "/resources";
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ResourceResponse[]>(resourcePath),
    ])
      .then(([meResponse, orgs, rows]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        setResources(q ? rows : rows.filter((r) => r.createdByUserId === meResponse.userId));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được danh sách tài nguyên.");
      });
  }, [router, q, sortTab]);

  function onVoteChange(resourceId: string, next: { voteCount: number; votedByMe: boolean }) {
    setResources((prev) => (prev ? prev.map((r) => (r.id === resourceId ? { ...r, ...next } : r)) : prev));
  }

  function onSaveChange(resourceId: string, next: { savedByMe: boolean }) {
    setResources((prev) => (prev ? prev.map((r) => (r.id === resourceId ? { ...r, ...next } : r)) : prev));
  }

  if (error) {
    return (
      <div className="uikit-main" style={{ maxWidth: 720, margin: "0 auto" }}>
        <p className="uikit-alert-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!me || !organizations || !resources) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <h1 style={{ fontSize: 22 }}>{q ? `Kết quả tìm kiếm: "${q}"` : "Tài nguyên của tôi"}</h1>
          <PrimaryButtonLink href="/resources/new" icon={Plus}>
            Đăng tài nguyên mới
          </PrimaryButtonLink>
        </div>

        {q && <Tabs tabs={[...SORT_TABS]} active={sortTab} onChange={(t) => setSortTab(t as (typeof SORT_TABS)[number])} />}

        <Card>
          {resources.length === 0 ? (
            <p className="uikit-empty">
              {q
                ? `Không tìm thấy tài nguyên nào khớp với "${q}".`
                : "Chưa có tài nguyên nào. Đăng bài báo, bộ dữ liệu, mô hình hay kết quả thực nghiệm đầu tiên để làm bằng chứng cho các technology case sau này."}
            </p>
          ) : (
            <table className="uikit-table">
              <thead>
                <tr>
                  <th>Tên tài nguyên</th>
                  <th>Loại</th>
                  <th>Quyền truy cập</th>
                  <th>Bình chọn</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/resources/${r.id}`} style={{ color: "var(--uikit-indigo-700)", fontWeight: 500, textDecoration: "none" }}>
                        {r.title}
                      </Link>
                    </td>
                    <td style={{ color: "var(--uikit-slate-500)" }}>{RESOURCE_TYPE_LABELS[r.type] ?? r.type}</td>
                    <td style={{ color: "var(--uikit-slate-500)" }}>
                      {RESOURCE_ACCESS_LEVEL_LABELS[r.accessLevel] ?? r.accessLevel}
                    </td>
                    <td>
                      <VoteButton
                        path={`/resources/${r.id}/votes`}
                        votedByMe={r.votedByMe}
                        voteCount={r.voteCount}
                        onChange={(next) => onVoteChange(r.id, next)}
                        onSessionExpired={() => router.push("/login")}
                      />
                    </td>
                    <td>
                      <SaveButton
                        path={`/resources/${r.id}/saves`}
                        savedByMe={r.savedByMe}
                        onChange={(next) => onSaveChange(r.id, next)}
                        onSessionExpired={() => router.push("/login")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Shell>
  );
}
