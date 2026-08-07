"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  GapResponse,
  MeResponse,
  ReadinessAssessmentResponse,
  RoadmapResponse,
  TechnologyCaseResponse,
} from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../../lib/api-client";
import { PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { Card, Shell, StatusPill } from "../../../components/ui";

interface ReviewItem {
  caseId: string;
  caseTitle: string;
  kind: "assessment" | "roadmap";
  id: string;
  summary: string;
  openCriticalGaps: number;
}

export default function ReviewsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    authFetch<MeResponse>("/me")
      .then(async (meResponse) => {
        if (meResponse.platformRole === "USER") {
          router.push("/dashboard");
          return;
        }
        setMe(meResponse);

        const cases = await authFetch<TechnologyCaseResponse[]>("/technology-cases");
        const result: ReviewItem[] = [];
        await Promise.all(
          cases.map(async (c) => {
            const [assessments, roadmaps, gaps] = await Promise.all([
              authFetch<ReadinessAssessmentResponse[]>(`/technology-cases/${c.id}/assessments`),
              authFetch<RoadmapResponse[]>(`/technology-cases/${c.id}/roadmaps`),
              authFetch<GapResponse[]>(`/technology-cases/${c.id}/gaps`),
            ]);
            const openCriticalGaps = gaps.filter(
              (g) => g.severity === "CRITICAL" && ["OPEN", "IN_PROGRESS"].includes(g.status),
            ).length;

            for (const a of assessments) {
              if (a.status === "SUBMITTED") {
                result.push({
                  caseId: c.id,
                  caseTitle: c.title,
                  kind: "assessment",
                  id: a.id,
                  summary: a.compositeScore != null ? `${a.compositeScore.toFixed(1)} điểm tổng hợp` : "Chưa có điểm tổng hợp",
                  openCriticalGaps,
                });
              }
            }
            for (const r of roadmaps) {
              if (r.status === "IN_REVIEW") {
                result.push({
                  caseId: c.id,
                  caseTitle: c.title,
                  kind: "roadmap",
                  id: r.id,
                  summary: `${r.title} · v${r.versionNo}`,
                  openCriticalGaps,
                });
              }
            }
          }),
        );
        setItems(result);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được hàng chờ duyệt.");
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

  if (!me) return null;

  const nav = navForPersona("platform-ops", me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, marginBottom: "var(--space-2)" }}>Đánh giá & lộ trình chờ duyệt</h1>
        <p style={{ fontSize: 14, color: "var(--uikit-slate-500)", marginBottom: "var(--space-5)" }}>
          Chỉ hiện các case bạn đang tham gia với vai trò kiểm định (case_member). Bấm vào để
          xem chi tiết và ra quyết định duyệt/từ chối.
        </p>

        <Card>
          {items === null ? null : items.length === 0 ? (
            <p className="uikit-empty">Không có đánh giá hoặc lộ trình nào đang chờ duyệt.</p>
          ) : (
            <div className="uikit-stack">
              {items.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.kind === "assessment" ? `/assessments/${item.id}` : `/roadmaps/${item.id}`}
                  style={{
                    display: "block",
                    border: "1px solid var(--uikit-slate-200)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-4)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{item.caseTitle}</p>
                      <p style={{ marginTop: 2, fontSize: 13, color: "var(--uikit-slate-500)" }}>
                        {item.kind === "assessment" ? "Đánh giá mức độ sẵn sàng" : "Lộ trình thương mại hoá"}
                      </p>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--uikit-slate-700)" }}>
                      {item.summary}
                    </span>
                  </div>
                  <div style={{ marginTop: "var(--space-3)" }}>
                    {item.openCriticalGaps > 0 ? (
                      <StatusPill tone="red">{item.openCriticalGaps} gap nghiêm trọng chưa xử lý</StatusPill>
                    ) : (
                      <StatusPill tone="green">Không có gap nghiêm trọng</StatusPill>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
