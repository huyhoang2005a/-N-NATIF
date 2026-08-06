"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TechnologyCaseResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { TECHNOLOGY_CASE_STATUS_LABELS, technologyCaseStatusTone } from "../../lib/labels";
import { getAccessToken } from "../../lib/session";
import { ButtonLink, TextLink } from "../_components/ui/Button";
import { Card, CardBody } from "../_components/ui/Card";
import { EmptyState } from "../_components/ui/EmptyState";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { Table } from "../_components/ui/Table";
import { SiteHeader } from "../_components/SiteHeader";

export default function TechnologyCasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<TechnologyCaseResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    authFetch<TechnologyCaseResponse[]>("/technology-cases")
      .then(setCases)
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

  return (
    <div className="shell">
      <SiteHeader />
      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)", maxWidth: 920 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)" }}>
          <div>
            <span className="eyebrow">Phase 3</span>
            <h1 style={{ fontSize: 28, marginTop: "var(--space-3)" }}>Technology Case</h1>
          </div>
          <ButtonLink href="/technology-cases/new" variant="primary">
            + Tạo case mới
          </ButtonLink>
        </div>

        <Card style={{ marginTop: "var(--space-6)" }}>
          <CardBody>
            {cases === null ? null : cases.length === 0 ? (
              <EmptyState message="Chưa có technology case nào bạn có quyền xem. Tạo case đầu tiên để bắt đầu theo dõi tiến trình thương mại hoá." />
            ) : (
              <Table columns={["Case", "Định danh", "Trạng thái"]}>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <TextLink href={`/technology-cases/${c.id}`}>{c.title}</TextLink>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-400)" }}>{c.slug}</td>
                    <td>
                      <StatusBadge
                        tone={technologyCaseStatusTone(c.lifecycleStatus)}
                        label={TECHNOLOGY_CASE_STATUS_LABELS[c.lifecycleStatus] ?? c.lifecycleStatus}
                      />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
