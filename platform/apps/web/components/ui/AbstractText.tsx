"use client";

import { useState } from "react";

const COLLAPSED_LENGTH = 220;

/** Renders `resource.summary` (PAPER→abstract, khác→description) — hides entirely when
 * null (rule 5 CLAUDE.md: no placeholder text for missing data), expands/collapses long
 * text. Shared by recommendation/feed cards and public profile resource lists. */
export function AbstractText({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const isLong = text.length > COLLAPSED_LENGTH;
  const shown = expanded || !isLong ? text : `${text.slice(0, COLLAPSED_LENGTH).trimEnd()}…`;

  return (
    <p style={{ fontSize: 13, color: "var(--uikit-slate-500)", whiteSpace: "pre-wrap" }}>
      {shown}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ marginLeft: 6, background: "none", border: "none", padding: 0, color: "var(--uikit-indigo-700)", fontSize: 13, cursor: "pointer" }}
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </p>
  );
}
