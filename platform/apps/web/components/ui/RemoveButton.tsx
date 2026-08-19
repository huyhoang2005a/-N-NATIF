"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { X } from "lucide-react";
import { ApiError, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";

/**
 * Reusable "X" row/card action for list pages. NOT a generic hard-delete button — the
 * `onRemove` callback each caller supplies must itself call whichever removal-equivalent
 * action already exists for that entity (archive/suspend/cancel/withdraw/dismiss/revoke/
 * a narrowly-scoped hard DELETE where one is actually safe) and update that page's own
 * local list state on success. This component only owns the click → confirm → busy →
 * error UI shell, matching how this app's other destructive actions confirm (case-
 * initiation "Từ chối", platform suspend forms): click once to reveal a "Chắc chắn?"
 * inline confirm, second click actually fires. `label` is the tooltip/aria-label (verb
 * matching the real action, e.g. "Lưu trữ tổ chức", "Rút đề xuất", "Xoá thông báo" — never
 * a generic "Xoá" when the underlying action is archive/cancel/withdraw).
 */
export function RemoveButton({
  label,
  confirmLabel = "Chắc chắn?",
  onRemove,
  onSessionExpired,
  onError,
}: {
  label: string;
  confirmLabel?: string;
  onRemove: () => Promise<void>;
  onSessionExpired?: () => void;
  onError?: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  function stop(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function askConfirm(event: MouseEvent) {
    stop(event);
    setConfirming(true);
  }

  function cancel(event: MouseEvent) {
    stop(event);
    setConfirming(false);
  }

  async function confirm(event: MouseEvent) {
    stop(event);
    if (busy) return;
    setBusy(true);
    try {
      await onRemove();
      // Success: caller already updated its own list state inside `onRemove`. Nothing
      // left to render here — the row/card is expected to disappear or re-render.
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        onSessionExpired?.();
        return;
      }
      onError?.(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại, vui lòng thử lại.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={askConfirm}
        title={label}
        aria-label={label}
        className="uikit-btn uikit-btn--ghost-red"
        style={{ padding: "4px 6px" }}
      >
        <X className="uikit-btn__icon" aria-hidden="true" />
      </button>
    );
  }

  return (
    <span
      onClick={stop}
      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", whiteSpace: "nowrap" }}
    >
      <span style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>{confirmLabel}</span>
      <button type="button" onClick={confirm} disabled={busy} className="uikit-btn uikit-btn--ghost-red">
        {busy ? "…" : "Có"}
      </button>
      <button type="button" onClick={cancel} disabled={busy} className="uikit-btn uikit-btn--ghost-slate">
        Không
      </button>
    </span>
  );
}
