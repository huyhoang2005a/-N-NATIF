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
import { Card, PageLoader, PrimaryButtonLink, RemoveButton, Shell, StatusDot } from "../../components/ui";

export default function TechnologyCasesPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [cases, setCases] = useState<TechnologyCaseResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  function onDelete(caseId: string) {
    return authFetch<void>(`/technology-cases/${caseId}`, { method: "DELETE" }).then(() => {
      setCases((prev) => (prev ? prev.filter((c) => c.id !== caseId) : prev));
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

  if (!me || !organizations || !cases) return <PageLoader />;
  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <h1 style={{ fontSize: 22 }}>Case của tôi</h1>
          {me.authorVerificationStatus === "VERIFIED" ? (
            <PrimaryButtonLink href="/technology-cases/new">+ Tạo case mới</PrimaryButtonLink>
          ) : (
            <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
              Bạn cần là tác giả đã xác minh mới tạo được case.{" "}
              <Link href="/profile" style={{ color: "var(--uikit-indigo-700)" }}>
                Xác minh ngay
              </Link>
            </p>
          )}
        </div>

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        <Card>
          {cases.length === 0 ? (
            <p className="uikit-empty">
              Chưa có case nào. Tạo case đầu tiên để bắt đầu theo dõi quá trình đánh giá, xử
              lý gap và lập lộ trình thương mại hoá công nghệ của bạn.
            </p>
          ) : (
            <div className="uikit-row-list">
              {cases.map((c) => (
                <div key={c.id} className="uikit-row">
                  <Link href={`/technology-cases/${c.id}`} style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-900)", textDecoration: "none" }}>
                    {c.title}
                  </Link>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <StatusDot
                      tone={toneOf(TECHNOLOGY_CASE_STATUS_TONE, c.lifecycleStatus)}
                      label={TECHNOLOGY_CASE_STATUS_LABELS[c.lifecycleStatus] ?? c.lifecycleStatus}
                    />
                    {c.lifecycleStatus === "DRAFT" && c.createdByUserId === me.userId && (
                      <RemoveButton
                        label="Xoá case nháp"
                        confirmLabel="Xoá case nháp này?"
                        onRemove={() => onDelete(c.id)}
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
      </div>
    </Shell>
  );
}
