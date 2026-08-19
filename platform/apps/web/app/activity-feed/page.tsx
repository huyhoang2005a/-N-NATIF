"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { ActivityFeedAttribution, ActivityFeedItemResponse, MeResponse, OrganizationResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { NEED_STATUS_LABELS, PLATFORM_ROLE_LABELS, RESOURCE_TYPE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { REFRESH_ACTIVE_NAV_EVENT } from "../../lib/refresh-event";
import { getAccessToken } from "../../lib/session";
import { NEED_STATUS_TONE, toneOf } from "../../lib/tone";
import { Card, GhostButton, PageLoader, SaveButton, Shell, StatusDot, VoteButton } from "../../components/ui";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Post-header avatar — same `.uikit-avatar` visual language as `Shell`'s topbar avatar
 * (real image when set, initials circle otherwise), just sized for a feed card header
 * instead of the topbar. */
function FeedAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div className="uikit-avatar uikit-avatar--md" aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt="" className="uikit-avatar__img" /> : <span>{initialsOf(name) || "?"}</span>}
    </div>
  );
}

function FeedByline({ attribution }: { attribution: ActivityFeedAttribution }) {
  const name = attribution.authorName ?? attribution.organizationName ?? "R2M";
  const href = attribution.authorSlug
    ? `/authors/${attribution.authorSlug}`
    : attribution.organizationSlug
      ? `/organizations/${attribution.organizationSlug}`
      : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <FeedAvatar name={name} avatarUrl={attribution.avatarUrl} />
      <div>
        {href ? (
          <Link href={href} style={{ fontSize: 14, fontWeight: 600, color: "var(--uikit-slate-900)", textDecoration: "none" }}>
            {name}
          </Link>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--uikit-slate-900)" }}>{name}</span>
        )}
      </div>
    </div>
  );
}

export default function ActivityFeedPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [items, setItems] = useState<ActivityFeedItemResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnceRef = useRef(false);

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!getAccessToken()) {
        router.push("/login");
        return;
      }
      if (opts?.silent) setRefreshing(true);
      Promise.all([
        authFetch<MeResponse>("/me"),
        authFetch<OrganizationResponse[]>("/organizations"),
        authFetch<ActivityFeedItemResponse[]>("/activity-feed"),
      ])
        .then(([meResponse, orgs, feed]) => {
          setMe(meResponse);
          setOrganizations(orgs);
          setItems(feed);
          setError(null);
          loadedOnceRef.current = true;
        })
        .catch((err) => {
          if (err instanceof SessionExpiredError) {
            router.push("/login");
            return;
          }
          setError("Không tải được bảng tin.");
        })
        .finally(() => setRefreshing(false));
    },
    [router],
  );

  // Làm mới khi: (1) vào trang lần đầu, (2) bấm lại mục "Bảng tin" trên sidebar khi đang
  // đứng sẵn ở trang này (Shell phát sự kiện này — không có điều hướng nào xảy ra vì cùng
  // route, nên phải tự bắt sự kiện để refetch, giống hành vi bấm lại icon Home của
  // Facebook/Instagram/Reddit).
  useEffect(() => {
    load();
    function onActiveNavClick() {
      load({ silent: true });
    }
    window.addEventListener(REFRESH_ACTIVE_NAV_EVENT, onActiveNavClick);
    return () => window.removeEventListener(REFRESH_ACTIVE_NAV_EVENT, onActiveNavClick);
  }, []);

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

  if (!me || !organizations || !items) return <PageLoader />;
  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole} nav={nav}>
      <div className="uikit-stack" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}
          onDoubleClick={() => load({ silent: true })}
          title="Bấm đúp để làm mới bảng tin"
        >
          <h1 style={{ fontSize: 22 }}>Bảng tin</h1>
          <GhostButton icon={RefreshCw} disabled={refreshing} onClick={() => load({ silent: true })}>
            {refreshing ? "Đang làm mới…" : "Làm mới"}
          </GhostButton>
        </div>

        {items.length === 0 ? (
          <Card>
            <p className="uikit-empty">
              Chưa có hoạt động nào từ tác giả/tổ chức bạn đang theo dõi — hãy theo dõi thêm
              tác giả hoặc tổ chức trên trang hồ sơ công khai của họ để lấp đầy bảng tin này.
            </p>
          </Card>
        ) : (
          items.map((item) => {
            const itemId = item.type === "RESOURCE" ? item.resource.id : item.researchNeed.id;
            const title = item.type === "RESOURCE" ? item.resource.title : item.researchNeed.title;
            const href = item.type === "RESOURCE" ? `/resources/${item.resource.id}` : `/needs/${item.researchNeed.id}`;
            const kindLabel = item.type === "RESOURCE" ? RESOURCE_TYPE_LABELS[item.resource.type] ?? item.resource.type : null;
            const voteInfo = item.type === "RESOURCE" ? item.resource : item.researchNeed;
            const votePath = item.type === "RESOURCE" ? `/resources/${itemId}/votes` : `/research-needs/${itemId}/votes`;
            const savePath = item.type === "RESOURCE" ? `/resources/${itemId}/saves` : `/research-needs/${itemId}/saves`;

            return (
              <Card key={`${item.type}-${itemId}`} className="uikit-stack" style={{ gap: "var(--space-3)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <FeedByline attribution={item.attribution} />
                  <span style={{ fontSize: 12, color: "var(--uikit-slate-500)", whiteSpace: "nowrap" }}>
                    {new Date(item.occurredAt).toLocaleString("vi-VN")}
                  </span>
                </div>

                <div>
                  <Link href={href} style={{ fontSize: 16, fontWeight: 600, color: "var(--uikit-slate-900)", textDecoration: "none" }}>
                    {title}
                  </Link>
                  {(kindLabel || item.type === "RESEARCH_NEED") && (
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: 2 }}>
                      {kindLabel && <span style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>{kindLabel}</span>}
                      {item.type === "RESEARCH_NEED" && (
                        <StatusDot
                          tone={toneOf(NEED_STATUS_TONE, item.researchNeed.status)}
                          label={NEED_STATUS_LABELS[item.researchNeed.status] ?? item.researchNeed.status}
                        />
                      )}
                    </div>
                  )}
                  {item.summary && (
                    <p
                      style={{
                        marginTop: "var(--space-2)",
                        fontSize: 14,
                        color: "var(--uikit-slate-700)",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.summary}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", borderTop: "1px solid var(--uikit-slate-200)", paddingTop: "var(--space-3)" }}>
                  <VoteButton
                    path={votePath}
                    votedByMe={voteInfo.votedByMe}
                    voteCount={voteInfo.voteCount}
                    onChange={(next) => onVoteChange(itemId, next)}
                    onSessionExpired={() => router.push("/login")}
                  />
                  <SaveButton
                    path={savePath}
                    savedByMe={voteInfo.savedByMe}
                    onChange={(next) => onSaveChange(itemId, next)}
                    onSessionExpired={() => router.push("/login")}
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </Shell>
  );
}
