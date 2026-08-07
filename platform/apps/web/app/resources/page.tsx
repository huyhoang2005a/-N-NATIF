"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse, ResourceResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS, RESOURCE_ACCESS_LEVEL_LABELS, RESOURCE_TYPE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { Card, PrimaryButtonLink, Shell } from "../../components/ui";

export default function ResourcesPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [resources, setResources] = useState<ResourceResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ResourceResponse[]>("/resources"),
    ])
      .then(([meResponse, orgs, rows]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        setResources(rows.filter((r) => r.createdByUserId === meResponse.userId));
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được danh sách tài nguyên.");
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

  if (!me || !organizations || !resources) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22 }}>Tài nguyên của tôi</h1>
          <PrimaryButtonLink href="/resources/new">+ Đăng tài nguyên mới</PrimaryButtonLink>
        </div>

        <Card>
          {resources.length === 0 ? (
            <p className="uikit-empty">
              Chưa có tài nguyên nào. Đăng bài báo, bộ dữ liệu, mô hình hay kết quả thực
              nghiệm đầu tiên để làm bằng chứng cho các technology case sau này.
            </p>
          ) : (
            <table className="uikit-table">
              <thead>
                <tr>
                  <th>Tên tài nguyên</th>
                  <th>Loại</th>
                  <th>Quyền truy cập</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id}>
                    <td style={{ color: "var(--uikit-slate-900)" }}>{r.title}</td>
                    <td style={{ color: "var(--uikit-slate-500)" }}>{RESOURCE_TYPE_LABELS[r.type] ?? r.type}</td>
                    <td style={{ color: "var(--uikit-slate-500)" }}>
                      {RESOURCE_ACCESS_LEVEL_LABELS[r.accessLevel] ?? r.accessLevel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Shell>
  );
}
