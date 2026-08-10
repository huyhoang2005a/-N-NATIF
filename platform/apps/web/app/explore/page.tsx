"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse, TechnicalFieldSummaryResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { Card, Shell } from "../../components/ui";

/** Cộng đồng đợt 7 — duyệt nhu cầu nghiên cứu theo lĩnh vực kỹ thuật, kiểu "subreddit"
 * của Reddit. Chỉ áp dụng cho research_need — resource không có field tương đương (xem
 * comment ở backend `research-needs.repository.ts`). */
export default function ExplorePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [fields, setFields] = useState<TechnicalFieldSummaryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<TechnicalFieldSummaryResponse[]>("/research-needs/fields"),
    ])
      .then(([meResponse, orgs, fieldRows]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        setFields(fieldRows);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được danh sách lĩnh vực.");
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

  if (!me || !organizations || !fields) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <h1 style={{ fontSize: 22 }}>Khám phá theo lĩnh vực</h1>
        <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>
          Duyệt nhu cầu nghiên cứu công khai đang mở theo lĩnh vực kỹ thuật.
        </p>

        <Card>
          {fields.length === 0 ? (
            <p className="uikit-empty">Hiện chưa có nhu cầu công khai nào đang mở để phân loại theo lĩnh vực.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
              {fields.map((f) => (
                <Link
                  key={f.field}
                  href={`/needs?field=${encodeURIComponent(f.field)}`}
                  style={{
                    display: "block",
                    padding: "var(--space-4)",
                    border: "1px solid var(--uikit-slate-200)",
                    borderRadius: "var(--radius-sm)",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--uikit-slate-900)" }}>{f.field}</p>
                  <p style={{ marginTop: 4, fontSize: 13, color: "var(--uikit-slate-500)" }}>
                    {f.count} nhu cầu đang mở
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
