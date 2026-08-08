"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse, ResearchNeedResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { NEED_STATUS_LABELS, PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { NEED_STATUS_TONE, toneOf } from "../../lib/tone";
import { Card, PrimaryButtonLink, Shell, StatusDot } from "../../components/ui";

export default function NeedsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [needs, setNeeds] = useState<ResearchNeedResponse[] | null>(null);
  const [publicNeeds, setPublicNeeds] = useState<ResearchNeedResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ResearchNeedResponse[]>("/research-needs"),
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

  if (!me || !organizations || !needs || !publicNeeds) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");
  const primaryOrg = organizations[0];
  const canCreate = primaryOrg?.type === "ENTERPRISE" && primaryOrg.status === "ACTIVE";
  const ownNeedIds = new Set(needs.map((n) => n.id));
  const otherPublicNeeds = publicNeeds.filter((n) => !ownNeedIds.has(n.id));

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22 }}>Nhu cầu nghiên cứu</h1>
          {canCreate && <PrimaryButtonLink href="/needs/new">+ Đăng nhu cầu mới</PrimaryButtonLink>}
        </div>

        {canCreate && (
          <Card>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)", marginBottom: "var(--space-3)" }}>
              Nhu cầu của tổ chức tôi
            </p>
            {needs.length === 0 ? (
              <p className="uikit-empty">
                Chưa có nhu cầu nghiên cứu nào. Đăng nhu cầu để nhận đề xuất từ tác giả hoặc gợi
                ý công nghệ phù hợp từ hệ thống.
              </p>
            ) : (
              <div className="uikit-row-list">
                {needs.map((n) => (
                  <Link key={n.id} href={`/needs/${n.id}`} className="uikit-row-link">
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{n.title}</span>
                    <StatusDot tone={toneOf(NEED_STATUS_TONE, n.status)} label={NEED_STATUS_LABELS[n.status] ?? n.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-500)", marginBottom: "var(--space-3)" }}>
            Nhu cầu công khai đang mở
          </p>
          {otherPublicNeeds.length === 0 ? (
            <p className="uikit-empty">Hiện chưa có nhu cầu công khai nào đang mở từ tổ chức khác.</p>
          ) : (
            <div className="uikit-row-list">
              {otherPublicNeeds.map((n) => (
                <Link key={n.id} href={`/needs/${n.id}`} className="uikit-row-link">
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{n.title}</span>
                  <StatusDot tone={toneOf(NEED_STATUS_TONE, n.status)} label={NEED_STATUS_LABELS[n.status] ?? n.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
