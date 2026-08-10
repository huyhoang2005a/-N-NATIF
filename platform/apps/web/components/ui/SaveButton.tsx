"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { Bookmark } from "lucide-react";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";

interface SaveTarget {
  savedByMe: boolean;
}

/** Bookmark toggle button (Cộng đồng đợt 2). `path` là endpoint `POST/DELETE .../saves`
 * của resource hoặc research-need — cùng mẫu idempotent như `VoteButton`. */
export function SaveButton({
  path,
  savedByMe,
  onChange,
  onSessionExpired,
}: {
  path: string;
  savedByMe: boolean;
  onChange: (next: SaveTarget) => void;
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
    authFetch<SaveTarget>(path, { method: savedByMe ? "DELETE" : "POST" })
      .then((result) => onChange({ savedByMe: result.savedByMe }))
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          onSessionExpired?.();
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Lưu thất bại.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={savedByMe}
      title={error ?? (savedByMe ? "Bỏ lưu" : "Lưu lại")}
      className={["uikit-vote-btn", savedByMe ? "uikit-vote-btn--active" : null].filter(Boolean).join(" ")}
    >
      <Bookmark className="uikit-vote-btn__icon" aria-hidden="true" fill={savedByMe ? "currentColor" : "none"} />
    </button>
  );
}
