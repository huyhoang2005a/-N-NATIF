"use client";

import { useId, useRef, useState } from "react";

interface MonthPoint {
  month: string;
  count: number;
}

const WIDTH = 480;
const HEIGHT = 140;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

const MONTH_LABELS_VI = [
  "Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12",
];

function formatMonthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return MONTH_LABELS_VI[d.getUTCMonth()] ?? iso;
}

/** Monthly counterpart to `WeeklyGrowthChart` — same single-hue sequential area/line
 * treatment and hover-crosshair interaction, just month-grained (6 zero-filled months from
 * `zeroFillMonthly` on the API side) for the admin dashboard's trend panels. Kept as a
 * separate component rather than a generic "unit" prop on `WeeklyGrowthChart`: the two
 * differ in point count (12 vs 6), label format, and aria copy, so a shared prop surface
 * would just push conditionals into the one component instead of removing them. */
export function MonthlyTrendChart({ title, data }: { title: string; data: MonthPoint[] }) {
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
          aria-label={`${title}: biểu đồ 6 tháng gần nhất`}
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

          {points.map((p, i) => (
            <text key={i} x={p.x} y={HEIGHT - 4} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={10} fill="var(--uikit-slate-400)">
              {formatMonthLabel(p.month)}
            </text>
          ))}
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
            <strong>{hovered.count}</strong> · {formatMonthLabel(hovered.month)}
          </div>
        )}
      </div>
    </div>
  );
}
