"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCheck, UserPlus } from "lucide-react";
import type { FollowActionResponse, FollowStatusResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { getAccessToken } from "../../lib/session";
import { GhostButton } from "./GhostButton";
import { PrimaryButton } from "./PrimaryButton";

/** Follow/Unfollow toggle for the `@Public()` author/organization profile pages (Cộng
 * đồng đợt 3). Those pages have no session check of their own (public, unauthenticated —
 * see `06_phase5_full_design.md` §5), so this component owns its own login-awareness: a
 * visitor with no token sees a "Đăng nhập để theo dõi" link instead of a toggle, and a
 * session that expires mid-use quietly reverts to that same prompt rather than redirecting
 * away from the public page the visitor is reading. */
export function FollowButton({
  kind,
  slug,
  onFollowerCountChange,
}: {
  kind: "authors" | "organizations";
  slug: string;
  onFollowerCountChange?: (count: number) => void;
}) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [followed, setFollowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    setLoggedIn(true);
    authFetch<FollowStatusResponse>(`/me/follows/${kind}/${slug}`)
      .then((res) => setFollowed(res.followed))
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          setLoggedIn(false);
          return;
        }
        setFollowed(false);
      });
  }, [kind, slug]);

  function toggle() {
    if (busy || followed === null) return;
    setBusy(true);
    setError(null);
    authFetch<FollowActionResponse>(`/${kind}/${slug}/follow`, { method: followed ? "DELETE" : "POST" })
      .then((res) => {
        setFollowed(res.followed);
        onFollowerCountChange?.(res.followerCount);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          setLoggedIn(false);
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại.");
      })
      .finally(() => setBusy(false));
  }

  if (!loggedIn) {
    return (
      <Link href="/login" className="uikit-btn uikit-btn--ghost-slate">
        Đăng nhập để theo dõi
      </Link>
    );
  }

  if (followed === null) return null;

  return (
    <div>
      {followed ? (
        <GhostButton icon={UserCheck} disabled={busy} onClick={toggle}>
          {busy ? "Đang xử lý…" : "Đang theo dõi"}
        </GhostButton>
      ) : (
        <PrimaryButton icon={UserPlus} disabled={busy} onClick={toggle}>
          {busy ? "Đang xử lý…" : "Theo dõi"}
        </PrimaryButton>
      )}
      {error && (
        <p className="uikit-alert-error" role="alert" style={{ marginTop: "var(--space-2)", fontSize: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
