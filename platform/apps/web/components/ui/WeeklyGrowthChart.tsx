"use client";

import { useId, useRef, useState } from "react";

interface WeekPoint {
  weekStart: string;
  count: number;
}

const WIDTH = 480;
const HEIGHT = 140;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

function formatWeekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Single-series sequential treatment (one hue, indigo) — a growth trend is magnitude
 * over time, not identity, so no categorical palette is needed (dataviz skill,
 * choosing-a-form: "trend over time → line/area, sequential or 1 categorical"). Always
 * exactly 12 zero-filled weeks (see `week-buckets.util.ts` on the API side), so the x-axis
 * never has to handle a variable-length series. */
export function WeeklyGrowthChart({ title, data }: { title: string; data: WeekPoint[] }) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const yMax = Math.ceil(maxCount * 1.2) || 1;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    ...d,
    x: PAD_LEFT + stepX * i,
    y: PAD_TOP + plotHeight - (d.count / yMax) * plotHeight,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x.toFixed(1)},${PAD_TOP + plotHeight} L${points[0]?.x.toFixed(1)},${PAD_TOP + plotHeight} Z`;

  const gridLines = [0, 0.5, 1].map((frac) => PAD_TOP + plotHeight * frac);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - px);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const last = points[points.length - 1];

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--uikit-slate-700)", marginBottom: "var(--space-2)" }}>{title}</p>
      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`${title}: biểu đồ 12 tuần gần nhất`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--uikit-indigo-700)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--uikit-indigo-700)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map((y, i) => (
            <line key={i} x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="var(--uikit-slate-200)" strokeWidth={1} />
          ))}

          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path d={linePath} fill="none" stroke="var(--uikit-indigo-700)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {hovered && (
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PAD_TOP}
              y2={PAD_TOP + plotHeight}
              stroke="var(--uikit-slate-400)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}

          {last && (
            <>
              <circle cx={last.x} cy={last.y} r={4} fill="var(--uikit-indigo-700)" stroke="var(--paper-0)" strokeWidth={2} />
              <text x={last.x} y={last.y - 10} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--uikit-slate-900)">
                {last.count}
              </text>
            </>
          )}

          {hovered && hoverIndex !== points.length - 1 && (
            <circle cx={hovered.x} cy={hovered.y} r={4} fill="var(--uikit-indigo-700)" stroke="var(--paper-0)" strokeWidth={2} />
          )}

          {points.map((p, i) => {
            if (i % 3 !== 0 && i !== points.length - 1) return null;
            const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
            return (
              <text key={i} x={p.x} y={HEIGHT - 4} textAnchor={anchor} fontSize={10} fill="var(--uikit-slate-400)">
                {formatWeekLabel(p.weekStart)}
              </text>
            );
          })}
        </svg>

        {hovered && (
          <div
            style={{
              position: "absolute",
              left: `${(hovered.x / WIDTH) * 100}%`,
              top: 0,
              transform: hoverIndex! > points.length - 3 ? "translateX(-100%)" : "translateX(-50%)",
              background: "var(--uikit-slate-900)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              padding: "4px 8px",
              fontSize: 12,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            <strong>{hovered.count}</strong> · tuần {formatWeekLabel(hovered.weekStart)}
          </div>
        )}
      </div>
    </div>
  );
}
