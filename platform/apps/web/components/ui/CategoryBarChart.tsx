"use client";

import { useState } from "react";
import type { Tone } from "../../lib/tone";

export const TONE_VAR: Record<Tone, string> = {
  gray: "var(--uikit-slate-400)",
  blue: "var(--uikit-blue-500)",
  green: "var(--uikit-emerald-500)",
  amber: "var(--uikit-amber-500)",
  red: "var(--uikit-rose-500)",
};

interface CategoryBarDatum {
  key: string;
  label: string;
  value: number;
  /** Omit for a plain magnitude breakdown (org type, user role) — all bars then share
   * the same indigo hue, per dataviz's "nominal categorical, one series → same slot-1
   * hue" rule (bar length already encodes the value; color must not re-encode identity).
   * Pass a tone only when the category IS a status (case lifecycle, verification state)
   * — reusing this app's existing status tone system, never a generated categorical. */
  tone?: Tone;
}

/** Horizontal bar — the dataviz-recommended form for "compare magnitude" over a small
 * set of named categories (safer than a pie/donut, which this app has no categorical
 * palette for anyway). Sorted by the caller; this component only renders. */
export function CategoryBarChart({ title, data }: { title: string; data: CategoryBarDatum[] }) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--uikit-slate-700)", marginBottom: "var(--space-3)" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {data.map((d) => {
          const widthPct = (d.value / max) * 100;
          const color = d.tone ? TONE_VAR[d.tone] : "var(--uikit-indigo-700)";
          const isHovered = hoverKey === d.key;
          return (
            <div
              key={d.key}
              style={{ display: "grid", gridTemplateColumns: "132px 1fr 32px", alignItems: "center", gap: "var(--space-2)" }}
              onPointerEnter={() => setHoverKey(d.key)}
              onPointerLeave={() => setHoverKey((k) => (k === d.key ? null : k))}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--uikit-slate-700)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={d.label}
              >
                {d.label}
              </span>
              <div style={{ background: "var(--uikit-slate-100)", borderRadius: "var(--radius-sm)", height: 20, position: "relative" }}>
                <div
                  style={{
                    width: `${Math.max(widthPct, d.value > 0 ? 3 : 0)}%`,
                    height: 20,
                    background: color,
                    borderRadius: "4px",
                    opacity: isHovered ? 0.85 : 1,
                    transition: "opacity 120ms ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--uikit-slate-900)",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                }}
              >
                {d.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
