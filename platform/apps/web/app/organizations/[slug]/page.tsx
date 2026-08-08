"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { PublicOrganizationProfileResponse } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { AbstractText, AuthorOrgByline, BrandMark, Card } from "../../../components/ui";

/** Public, unauthenticated — same scope rules as `/authors/[slug]`: `PUBLIC` resources
 * only, `VERIFIED` authors only, no case/evidence/assessment data. */
export default function PublicOrganizationProfilePage() {
  const params = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicOrganizationProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PublicOrganizationProfileResponse>(`/organizations/${params.slug}/public-profile`)
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được hồ sơ tổ chức."));
  }, [params.slug]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-5)" }}>
        <BrandMark />
        <span style={{ fontWeight: 600 }}>R2M</span>
      </Link>

      {error && (
        <p className="uikit-alert-error" role="alert">
          {error}
        </p>
      )}

      {!error && !profile && <p className="uikit-empty">Đang tải…</p>}

      {profile && (
        <div className="uikit-stack">
          <Card>
            <h1 style={{ fontSize: 22 }}>{profile.name}</h1>
            <AbstractText text={profile.description} />
          </Card>

          {profile.authors.length > 0 && (
            <Card>
              <h2 style={{ fontSize: 16, marginBottom: "var(--space-3)" }}>Tác giả đã xác minh</h2>
              <div className="uikit-stack">
                {profile.authors.map((a) => (
                  <AuthorOrgByline key={a.publicSlug ?? a.displayName} authorName={a.displayName} authorSlug={a.publicSlug} />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 style={{ fontSize: 16, marginBottom: "var(--space-3)" }}>Tài nguyên công khai</h2>
            {profile.resources.length === 0 ? (
              <p className="uikit-empty">Chưa có tài nguyên công khai nào.</p>
            ) : (
              <div className="uikit-stack">
                {profile.resources.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--uikit-slate-200)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</p>
                    <AbstractText text={r.summary} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
