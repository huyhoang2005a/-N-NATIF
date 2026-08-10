"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { ChevronUp } from "lucide-react";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";

interface VoteTarget {
  voteCount: number;
  votedByMe: boolean;
}

/** Upvote-only toggle button (đã chốt: không có downvote). `path` là endpoint
 * `POST/DELETE .../votes` của resource hoặc research-need — component tự đổi method
 * theo trạng thái `votedByMe` hiện tại, idempotent ở backend nên bấm nhanh nhiều lần
 * không lỗi. */
export function VoteButton({
  path,
  votedByMe,
  voteCount,
  onChange,
  onSessionExpired,
}: {
  path: string;
  votedByMe: boolean;
  voteCount: number;
  onChange: (next: VoteTarget) => void;
  onSessionExpired?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    setError(null);
    authFetch<VoteTarget>(path, { method: votedByMe ? "DELETE" : "POST" })
      .then((result) => onChange({ voteCount: result.voteCount, votedByMe: result.votedByMe }))
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          onSessionExpired?.();
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Bỏ phiếu thất bại.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={votedByMe}
      title={error ?? (votedByMe ? "Bỏ upvote" : "Upvote")}
      className={["uikit-vote-btn", votedByMe ? "uikit-vote-btn--active" : null].filter(Boolean).join(" ")}
    >
      <ChevronUp className="uikit-vote-btn__icon" aria-hidden="true" />
      <span>{voteCount}</span>
    </button>
  );
}
