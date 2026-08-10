"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { Award } from "lucide-react";
import type { EndorseActionResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";

/** Endorse toggle for one expertise tag on an author's public profile (Cộng đồng đợt 6).
 * Reuses `.uikit-vote-btn` styling (same "small toggle chip, indigo when active" language
 * as `VoteButton`) instead of adding a new pill variant. Same login-awareness pattern as
 * `FollowButton`: the public profile page has no session of its own, so a logged-out
 * visitor sees a disabled chip rather than a working toggle. */
export function EndorseButton({
  slug,
  tag,
  endorsementCount,
  endorsedByMe,
  loggedIn,
  onChange,
  onSessionExpired,
}: {
  slug: string;
  tag: string;
  endorsementCount: number;
  endorsedByMe: boolean;
  loggedIn: boolean;
  onChange: (next: { endorsed: boolean; endorsementCount: number }) => void;
  onSessionExpired?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(event: MouseEvent) {
    event.preventDefault();
    if (!loggedIn || busy) return;
    setBusy(true);
    setError(null);
    authFetch<EndorseActionResponse>(`/authors/${slug}/expertise/${encodeURIComponent(tag)}/endorsements`, {
      method: endorsedByMe ? "DELETE" : "POST",
    })
      .then((res) => onChange({ endorsed: res.endorsed, endorsementCount: res.endorsementCount }))
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          onSessionExpired?.();
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || !loggedIn}
      aria-pressed={endorsedByMe}
      title={error ?? (!loggedIn ? "Đăng nhập để xác nhận kỹ năng" : endorsedByMe ? "Bỏ xác nhận kỹ năng" : "Xác nhận kỹ năng này")}
      className={["uikit-vote-btn", endorsedByMe ? "uikit-vote-btn--active" : null].filter(Boolean).join(" ")}
    >
      <Award className="uikit-vote-btn__icon" aria-hidden="true" />
      <span>{tag}</span>
      {endorsementCount > 0 && <span>· {endorsementCount}</span>}
    </button>
  );
}
