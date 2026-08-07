"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse, TechnologyCaseResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS, TECHNOLOGY_CASE_STATUS_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { toneOf, TECHNOLOGY_CASE_STATUS_TONE } from "../../lib/tone";
import { Card, PrimaryButtonLink, Shell, StatusDot } from "../../components/ui";

export default function TechnologyCasesPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [cases, setCases] = useState<TechnologyCaseResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<TechnologyCaseResponse[]>("/technology-cases"),
    ])
      .then(([meResponse, orgs, rows]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        setCases(rows);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được danh sách case.");
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

  if (!me || !organizations || !cases) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22 }}>Case của tôi</h1>
          <PrimaryButtonLink href="/technology-cases/new">+ Tạo case mới</PrimaryButtonLink>
        </div>

        <Card>
          {cases.length === 0 ? (
            <p className="uikit-empty">
              Chưa có case nào. Tạo case đầu tiên để bắt đầu theo dõi quá trình đánh giá, xử
              lý gap và lập lộ trình thương mại hoá công nghệ của bạn.
            </p>
          ) : (
            <div className="uikit-row-list">
              {cases.map((c) => (
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
    </Shell>
  );
}
