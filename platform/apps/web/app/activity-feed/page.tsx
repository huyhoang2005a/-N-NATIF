"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActivityFeedItemResponse, MeResponse, OrganizationResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { NEED_STATUS_LABELS, PLATFORM_ROLE_LABELS, RESOURCE_TYPE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { NEED_STATUS_TONE, toneOf } from "../../lib/tone";
import { Card, SaveButton, Shell, StatusDot, VoteButton } from "../../components/ui";

export default function ActivityFeedPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [items, setItems] = useState<ActivityFeedItemResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<ActivityFeedItemResponse[]>("/activity-feed"),
    ])
      .then(([meResponse, orgs, feed]) => {
        setMe(meResponse);
        setOrganizations(orgs);
        setItems(feed);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          router.push("/login");
          return;
        }
        setError("Không tải được bảng tin.");
      });
  }, [router]);

  function onVoteChange(itemId: string, next: { voteCount: number; votedByMe: boolean }) {
    setItems((prev) =>
      prev
        ? prev.map((item) => {
            if (item.type === "RESOURCE" && item.resource.id === itemId) {
              return { ...item, resource: { ...item.resource, ...next } };
            }
            if (item.type === "RESEARCH_NEED" && item.researchNeed.id === itemId) {
              return { ...item, researchNeed: { ...item.researchNeed, ...next } };
            }
            return item;
          })
        : prev,
    );
  }

  function onSaveChange(itemId: string, next: { savedByMe: boolean }) {
    setItems((prev) =>
      prev
        ? prev.map((item) => {
            if (item.type === "RESOURCE" && item.resource.id === itemId) {
              return { ...item, resource: { ...item.resource, ...next } };
            }
            if (item.type === "RESEARCH_NEED" && item.researchNeed.id === itemId) {
              return { ...item, researchNeed: { ...item.researchNeed, ...next } };
            }
            return item;
          })
        : prev,
    );
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

  if (!me || !organizations || !items) return null;

  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack">
        <h1 style={{ fontSize: 22 }}>Bảng tin</h1>

        <Card>
          {items.length === 0 ? (
            <p className="uikit-empty">
              Chưa có hoạt động nào từ tác giả/tổ chức bạn đang theo dõi — hãy theo dõi thêm
              tác giả hoặc tổ chức trên trang hồ sơ công khai của họ để lấp đầy bảng tin này.
            </p>
          ) : (
            <div className="uikit-row-list">
              {items.map((item) => {
                const itemId = item.type === "RESOURCE" ? item.resource.id : item.researchNeed.id;
                return (
                  <div key={`${item.type}-${itemId}`} className="uikit-row">
                    {item.type === "RESOURCE" ? (
                      <Link href={`/resources/${item.resource.id}`} style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-900)", textDecoration: "none" }}>
                        {item.resource.title}
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "var(--uikit-slate-500)" }}>
                          {RESOURCE_TYPE_LABELS[item.resource.type] ?? item.resource.type}
                        </span>
                      </Link>
                    ) : (
                      <Link href={`/needs/${item.researchNeed.id}`} style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-900)", textDecoration: "none" }}>
                        {item.researchNeed.title}
                      </Link>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      {item.type === "RESOURCE" ? (
                        <>
                          <VoteButton
                            path={`/resources/${item.resource.id}/votes`}
                            votedByMe={item.resource.votedByMe}
                            voteCount={item.resource.voteCount}
                            onChange={(next) => onVoteChange(item.resource.id, next)}
                            onSessionExpired={() => router.push("/login")}
                          />
                          <SaveButton
                            path={`/resources/${item.resource.id}/saves`}
                            savedByMe={item.resource.savedByMe}
                            onChange={(next) => onSaveChange(item.resource.id, next)}
                            onSessionExpired={() => router.push("/login")}
                          />
                        </>
                      ) : (
                        <>
                          <VoteButton
                            path={`/research-needs/${item.researchNeed.id}/votes`}
                            votedByMe={item.researchNeed.votedByMe}
                            voteCount={item.researchNeed.voteCount}
                            onChange={(next) => onVoteChange(item.researchNeed.id, next)}
                            onSessionExpired={() => router.push("/login")}
                          />
                          <SaveButton
                            path={`/research-needs/${item.researchNeed.id}/saves`}
                            savedByMe={item.researchNeed.savedByMe}
                            onChange={(next) => onSaveChange(item.researchNeed.id, next)}
                            onSessionExpired={() => router.push("/login")}
                          />
                          <StatusDot
                            tone={toneOf(NEED_STATUS_TONE, item.researchNeed.status)}
                            label={NEED_STATUS_LABELS[item.researchNeed.status] ?? item.researchNeed.status}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
