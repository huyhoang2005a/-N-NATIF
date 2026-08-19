"use client";

import { useState } from "react";
import type { Tone } from "../../lib/tone";
import { TONE_VAR } from "./CategoryBarChart";

interface DonutDatum {
  key: string;
  label: string;
  value: number;
  /** Status tone (case lifecycle, verification state, ...) — reusing this app's existing
   * reserved status-tone system, same rule `CategoryBarChart` already follows. A donut
   * needs one distinct color per slice by construction (it's reading identity, not just
   * magnitude), so unlike the bar chart this prop isn't optional here: there is no
   * validated arbitrary categorical palette in this app yet (see that component's note) —
   * only use this chart where every category already has a real status tone. */
  tone: Tone;
}

const SIZE = 160;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_PX = 3;

/** Donut, not a full pie — the ring leaves the center free for a hero total (dataviz's
 * "hub label" allowance), which a solid pie doesn't have room for. Segments are
 * `stroke-dasharray`'d circles stacked at the same center rather than hand-built arc
 * paths — much less path math for the same visual result, and the small per-segment
 * `GAP_PX` reproduces the "surface gap between adjacent fills" mark spec without needing
 * true arc geometry. Always status-toned (see `DonutDatum.tone`), so color already carries
 * real meaning — no separate legend swatches needed beyond what's shown inline. */
export function DonutChart({ title, data }: { title: string; data: DonutDatum[] }) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let cumulative = 0;
  const segments = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const length = Math.max(fraction * CIRCUMFERENCE - GAP_PX, 0);
    const offset = -cumulative * CIRCUMFERENCE;
    cumulative += fraction;
    return { ...d, length, offset, fraction };
  });

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--uikit-slate-700)", marginBottom: "var(--space-3)" }}>{title}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={`${title}: biểu đồ tròn`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--uikit-slate-100)" strokeWidth={STROKE} />
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {segments.map((s) => (
                <circle
                  key={s.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={TONE_VAR[s.tone]}
                  strokeWidth={STROKE}
                  strokeDasharray={`${s.length} ${CIRCUMFERENCE - s.length}`}
                  strokeDashoffset={s.offset}
                  strokeLinecap="round"
                  opacity={hoverKey && hoverKey !== s.key ? 0.35 : 1}
                  style={{ transition: "opacity 120ms ease", cursor: "default" }}
                  onPointerEnter={() => setHoverKey(s.key)}
                  onPointerLeave={() => setHoverKey((k) => (k === s.key ? null : k))}
                />
              ))}
            </g>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: "var(--uikit-slate-900)" }}>
              {hoverKey ? (segments.find((s) => s.key === hoverKey)?.value ?? total) : total}
            </span>
            <span style={{ fontSize: 11, color: "var(--uikit-slate-500)" }}>
              {hoverKey ? segments.find((s) => s.key === hoverKey)?.label : "Tổng"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", flex: 1, minWidth: 140 }}>
          {segments.map((s) => (
            <div
              key={s.key}
              style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", opacity: hoverKey && hoverKey !== s.key ? 0.5 : 1, transition: "opacity 120ms ease" }}
              onPointerEnter={() => setHoverKey(s.key)}
              onPointerLeave={() => setHoverKey((k) => (k === s.key ? null : k))}
            >
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: TONE_VAR[s.tone], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--uikit-slate-700)", flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-900)", fontVariantNumeric: "tabular-nums" }}>
                {s.value} · {(s.fraction * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
