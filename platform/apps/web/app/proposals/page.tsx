"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse, ResearchProposalResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS, PROPOSAL_STATUS_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { PROPOSAL_STATUS_TONE, toneOf } from "../../lib/tone";
import { Card, PageLoader, Shell, StatusDot } from "../../components/ui";

export default function ProposalsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [proposals, setProposals] = useState<ResearchProposalResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ResearchProposalResponse[]>("/proposals"),
    ])
      .then(([meResponse, orgs, rows]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        setProposals(rows);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được danh sách đề xuất.");
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

  if (!me || !organizations || !proposals) return <PageLoader />;
  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <h1 style={{ fontSize: 22 }}>Đề xuất của tôi</h1>
        <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
          Duyệt các nhu cầu nghiên cứu công khai đang mở ở trang{" "}
          <a href="/needs">Nhu cầu nghiên cứu</a> để gửi đề xuất mới.
        </p>

        <Card>
          {proposals.length === 0 ? (
            <p className="uikit-empty">Bạn chưa gửi đề xuất nào.</p>
          ) : (
            <div className="uikit-row-list">
              {proposals.map((p) => (
                <div key={p.id} className="uikit-row-link" style={{ cursor: "default" }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{p.title}</span>
                  <StatusDot tone={toneOf(PROPOSAL_STATUS_TONE, p.status)} label={PROPOSAL_STATUS_LABELS[p.status] ?? p.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
