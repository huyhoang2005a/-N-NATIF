"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { MeResponse, OrganizationResponse, ResearchNeedResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { NEED_STATUS_LABELS, PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { NEED_STATUS_TONE, toneOf } from "../../lib/tone";
import { Card, PageLoader, PrimaryButtonLink, RemoveButton, SaveButton, Shell, StatusDot, Tabs, VoteButton } from "../../components/ui";

const SORT_TABS = ["Mới nhất", "Điểm cao nhất", "Thịnh hành"] as const;
const SORT_TAB_TO_VALUE: Record<(typeof SORT_TABS)[number], "new" | "top" | "hot"> = {
  "Mới nhất": "new",
  "Điểm cao nhất": "top",
  "Thịnh hành": "hot",
};

export default function NeedsPage() {
  return (
    <Suspense fallback={null}>
      <NeedsPageInner />
    </Suspense>
  );
}

function NeedsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const field = searchParams.get("field") ?? "";
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [needs, setNeeds] = useState<ResearchNeedResponse[] | null>(null);
  const [publicNeeds, setPublicNeeds] = useState<ResearchNeedResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sortTab, setSortTab] = useState<(typeof SORT_TABS)[number]>("Mới nhất");

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    const sort = SORT_TAB_TO_VALUE[sortTab];
    const params = new URLSearchParams({ sort });
    if (field) params.set("field", field);
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ResearchNeedResponse[]>(`/research-needs?${params.toString()}`),
    ])
      .then(([meResponse, orgs, pub]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        setPublicNeeds(pub);
        const primaryOrg = orgs[0];
        if (!primaryOrg) {
          setNeeds([]);
          return;
        }
        return authFetch<ResearchNeedResponse[]>(`/organizations/${primaryOrg.id}/research-needs`).then(setNeeds);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được danh sách nhu cầu nghiên cứu.");
      });
  }, [router, sortTab, field]);

  function onVoteChange(needId: string, next: { voteCount: number; votedByMe: boolean }) {
    setPublicNeeds((prev) => (prev ? prev.map((n) => (n.id === needId ? { ...n, ...next } : n)) : prev));
  }

  function onSaveChange(needId: string, next: { savedByMe: boolean }) {
    setPublicNeeds((prev) => (prev ? prev.map((n) => (n.id === needId ? { ...n, ...next } : n)) : prev));
  }

  function onClose(needId: string) {
    return authFetch<ResearchNeedResponse>(`/research-needs/${needId}/close`, { method: "POST" }).then((updated) => {
      setNeeds((prev) => (prev ? prev.map((n) => (n.id === updated.id ? updated : n)) : prev));
    });
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

  if (!me || !organizations || !needs || !publicNeeds) return <PageLoader />;
  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");
  const primaryOrg = organizations[0];
  const canCreate = primaryOrg?.type === "ENTERPRISE" && primaryOrg.status === "ACTIVE";
  const ownNeedIds = new Set(needs.map((n) => n.id));
  const otherPublicNeeds = publicNeeds.filter((n) => !ownNeedIds.has(n.id));

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1 style={{ fontSize: 22 }}>Nhu cầu nghiên cứu</h1>
            <Link href="/explore" style={{ fontSize: 13, color: "var(--uikit-indigo-700)", textDecoration: "none" }}>
              Khám phá theo lĩnh vực →
            </Link>
          </div>
          {canCreate && <PrimaryButtonLink href="/needs/new">+ Đăng nhu cầu mới</PrimaryButtonLink>}
        </div>

        {canCreate && (
          <Card>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)", marginBottom: "var(--space-3)" }}>
              Nhu cầu của tổ chức tôi
            </p>
            {actionError && (
              <p className="uikit-alert-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>
                {actionError}
              </p>
            )}
            {needs.length === 0 ? (
              <p className="uikit-empty">
                Chưa có nhu cầu nghiên cứu nào. Đăng nhu cầu để nhận đề xuất từ tác giả hoặc gợi
                ý công nghệ phù hợp từ hệ thống.
              </p>
            ) : (
              <div className="uikit-row-list">
                {needs.map((n) => (
                  <div key={n.id} className="uikit-row">
                    <Link href={`/needs/${n.id}`} style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-900)", textDecoration: "none" }}>
                      {n.title}
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <StatusDot tone={toneOf(NEED_STATUS_TONE, n.status)} label={NEED_STATUS_LABELS[n.status] ?? n.status} />
                      {n.status === "OPEN" && (
                        <RemoveButton
                          label="Đóng nhu cầu"
                          confirmLabel="Đóng nhu cầu này?"
                          onRemove={() => onClose(n.id)}
                          onSessionExpired={() => router.push("/login")}
                          onError={setActionError}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)" }}>
                Nhu cầu công khai đang mở
              </p>
              {field && (
                <Link
                  href="/needs"
                  className="uikit-pill uikit-pill--blue"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Lĩnh vực: {field}
                  <X size={12} aria-hidden="true" />
                </Link>
              )}
            </div>
            <Tabs tabs={[...SORT_TABS]} active={sortTab} onChange={(t) => setSortTab(t as (typeof SORT_TABS)[number])} />
          </div>
          {otherPublicNeeds.length === 0 ? (
            <p className="uikit-empty">Hiện chưa có nhu cầu công khai nào đang mở từ tổ chức khác.</p>
          ) : (
            <div className="uikit-row-list">
              {otherPublicNeeds.map((n) => (
                <div key={n.id} className="uikit-row">
                  <Link href={`/needs/${n.id}`} style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-900)", textDecoration: "none" }}>
                    {n.title}
                  </Link>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <VoteButton
                      path={`/research-needs/${n.id}/votes`}
                      votedByMe={n.votedByMe}
                      voteCount={n.voteCount}
                      onChange={(next) => onVoteChange(n.id, next)}
                      onSessionExpired={() => router.push("/login")}
                    />
                    <SaveButton
                      path={`/research-needs/${n.id}/saves`}
                      savedByMe={n.savedByMe}
                      onChange={(next) => onSaveChange(n.id, next)}
                      onSessionExpired={() => router.push("/login")}
                    />
                    <StatusDot tone={toneOf(NEED_STATUS_TONE, n.status)} label={NEED_STATUS_LABELS[n.status] ?? n.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
