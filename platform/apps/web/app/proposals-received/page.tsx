"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse, ResearchNeedResponse, ResearchProposalResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS, PROPOSAL_STATUS_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { PROPOSAL_STATUS_TONE, toneOf } from "../../lib/tone";
import { Card, PageLoader, RemoveButton, SectionHeader, Shell, StatusDot } from "../../components/ui";

/** Only a decided proposal can be dismissed from view — one still awaiting a decision must
 * stay visible (dismissing it would be a confusing way to lose track of something
 * actionable). Matches the backend's own guard in proposals.service.ts#dismiss. */
const DISMISSABLE_STATUSES = new Set(["ACCEPTED", "REJECTED", "WITHDRAWN"]);

interface NeedWithProposals {
  need: ResearchNeedResponse;
  proposals: ResearchProposalResponse[];
}

export default function ProposalsReceivedPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [groups, setGroups] = useState<NeedWithProposals[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function onDismiss(needId: string, proposalId: string) {
    return authFetch(`/proposals/${proposalId}/dismiss`, { method: "POST" }).then(() => {
      setGroups((prev) =>
        prev
          ?.map((g) => (g.need.id === needId ? { ...g, proposals: g.proposals.filter((p) => p.id !== proposalId) } : g))
          .filter((g) => g.proposals.length > 0) ?? null,
      );
    });
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([authFetch<MeResponse>("/me"), authFetch<OrganizationResponse[]>("/organizations")])
      .then(async ([meResponse, orgs]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        const primaryOrg = orgs[0];
        if (!primaryOrg) {
          setGroups([]);
          return;
        }
        const needs = await authFetch<ResearchNeedResponse[]>(`/organizations/${primaryOrg.id}/research-needs`);
        const withProposals = await Promise.all(
          needs.map((need) =>
            authFetch<ResearchProposalResponse[]>(`/research-needs/${need.id}/proposals`).then((proposals) => ({ need, proposals })),
          ),
        );
        setGroups(withProposals.filter((g) => g.proposals.length > 0));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được danh sách đề xuất nhận được.");
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

  if (!me || !organizations || !groups) return <PageLoader />;
  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <h1 style={{ fontSize: 22 }}>Đề xuất nhận được</h1>
        <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
          Xem và phản hồi (bắt đầu xem xét / chấp nhận / từ chối) trực tiếp ở trang chi tiết từng
          nhu cầu nghiên cứu.
        </p>

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        {groups.length === 0 ? (
          <Card>
            <p className="uikit-empty">Chưa có đề xuất nào được gửi cho nhu cầu nghiên cứu của bạn.</p>
          </Card>
        ) : (
          groups.map(({ need, proposals }) => (
            <Card key={need.id}>
              <SectionHeader title={need.title} />
              <div className="uikit-row-list">
                {proposals.map((p) => (
                  <div key={p.id} className="uikit-row">
                    <Link href={`/needs/${need.id}`} style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-900)", textDecoration: "none" }}>
                      {p.title}
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <StatusDot tone={toneOf(PROPOSAL_STATUS_TONE, p.status)} label={PROPOSAL_STATUS_LABELS[p.status] ?? p.status} />
                      {DISMISSABLE_STATUSES.has(p.status) && (
                        <RemoveButton
                          label="Ẩn khỏi màn hình"
                          confirmLabel="Ẩn đề xuất này?"
                          onRemove={() => onDismiss(need.id, p.id)}
                          onSessionExpired={() => router.push("/login")}
                          onError={setActionError}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </Shell>
  );
}
