"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS, PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { getAccessToken } from "../../lib/session";
import { SiteHeader } from "../_components/SiteHeader";

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([authFetch<MeResponse>("/me"), authFetch<OrganizationResponse[]>("/organizations")])
      .then(([meResponse, orgs]) => {
        setMe(meResponse);
        setOrganizations(orgs);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được dữ liệu bảng điều khiển.");
      });
  }, [router]);

  if (error) {
    return (
      <div className="shell">
        <SiteHeader />
        <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)" }}>
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!me || !organizations) {
    return (
      <div className="shell">
        <SiteHeader />
      </div>
    );
  }

  return (
    <div className="shell">
      <SiteHeader />
      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)", maxWidth: 760 }}>
        <span className="eyebrow">Tài khoản</span>
        <h1 style={{ fontSize: 30, marginTop: "var(--space-4)" }}>Bảng điều khiển</h1>

        {me.platformRole !== "USER" && (
          <div className="callout" style={{ marginTop: "var(--space-6)" }}>
            <div>
              <strong>{PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole}</strong>
              <p style={{ marginTop: "var(--space-1)", fontSize: 14, color: "var(--ink-700)" }}>
                Bạn có thể xét duyệt hồ sơ tổ chức đang chờ xác minh.
              </p>
            </div>
            <Link href="/platform/organization-verifications" className="btn btn-primary">
              Xét duyệt tổ chức
            </Link>
          </div>
        )}

        <div className="card" style={{ marginTop: "var(--space-6)" }}>
          <span className="eyebrow">Hồ sơ cá nhân</span>
          <h2 style={{ fontSize: 20, marginTop: "var(--space-3)" }}>{me.displayName}</h2>
          <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--ink-700)" }}>{me.primaryEmail}</p>
          <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--ink-400)" }}>
            Vai trò: {PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole}
          </p>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)" }}>
            <span className="eyebrow">Tổ chức của tôi</span>
            <Link href="/register-organization" className="nav-link">
              + Đăng ký tổ chức mới
            </Link>
          </div>

          {organizations.length === 0 ? (
            <p className="empty-state">Bạn chưa là thành viên của tổ chức nào.</p>
          ) : (
            <div className="row-list" style={{ marginTop: "var(--space-5)" }}>
              {organizations.map((org) => (
                <div key={org.id} className="row-card">
                  <div>
                    <strong>{org.name}</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: 13, color: "var(--ink-400)" }}>
                      {ORG_TYPE_LABELS[org.type]}
                    </p>
                  </div>
                  <span className="badge badge-pending">{ORG_STATUS_LABELS[org.status] ?? org.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
