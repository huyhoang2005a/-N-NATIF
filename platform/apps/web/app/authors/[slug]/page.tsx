"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { PublicAuthorProfileResponse } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { AbstractText, AuthorOrgByline, BrandMark, Card, FollowButton } from "../../../components/ui";

/** Public, unauthenticated — no `Shell`/sidebar, no auth check. `06_phase5_full_design.md`
 * §5: only `PUBLIC` resources, no case/evidence/assessment data at all. */
export default function PublicAuthorProfilePage() {
  const params = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicAuthorProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PublicAuthorProfileResponse>(`/authors/${params.slug}/public-profile`)
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? describeErrorCode(err.code) : "Không tải được hồ sơ tác giả."));
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
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <h1 style={{ fontSize: 22 }}>{profile.displayName}</h1>
                  <span className="uikit-pill uikit-pill--green">
                    <span className="uikit-dot uikit-dot--green" /> Tác giả đã xác minh
                  </span>
                </div>
                <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>
                  {profile.followerCount} người theo dõi
                </p>
              </div>
              <FollowButton
                kind="authors"
                slug={profile.publicSlug}
                onFollowerCountChange={(count) => setProfile((prev) => (prev ? { ...prev, followerCount: count } : prev))}
              />
            </div>
            <AuthorOrgByline organizationName={profile.affiliationOrganizationName} organizationSlug={profile.affiliationOrganizationSlug} />
            {profile.orcid && <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-slate-500)" }}>ORCID: {profile.orcid}</p>}
            <AbstractText text={profile.bio} />
            {profile.expertiseTags.length > 0 && (
              <div style={{ marginTop: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {profile.expertiseTags.map((tag) => (
                  <span key={tag} className="uikit-pill uikit-pill--gray">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Card>

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
