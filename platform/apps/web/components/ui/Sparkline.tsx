const WIDTH = 240;
const HEIGHT = 56;
const PAD_X = 2;
const PAD_Y = 6;

/** Decorative micro-trend for a `KpiTrendCard` — not a primary chart (the card's big
 * number + delta % are what's actually read), so unlike `WeeklyGrowthChart`/
 * `MonthlyTrendChart` this has no axes, labels, or hover layer. Single indigo hue (same
 * sequential-magnitude treatment as every other growth chart in this app).
 *
 * `width: 100%` + a wide viewBox (not a fixed small pixel box) so it stretches to fill
 * whatever the card gives it — a fixed-size sparkline in a wide card left most of the card
 * empty and looked disconnected from the number above it (feedback from a live screenshot,
 * 2026-08-19). This is meant to run the full card width as a footer band, not sit as a
 * small top-right ornament. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const stepX = (WIDTH - PAD_X * 2) / (values.length - 1);

  const points = values.map((v, i) => ({
    x: PAD_X + stepX * i,
    y: PAD_Y + (HEIGHT - PAD_Y * 2) * (1 - (v - min) / range),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]!.x.toFixed(1)},${HEIGHT} L${points[0]!.x.toFixed(1)},${HEIGHT} Z`;
  const last = points[points.length - 1]!;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: HEIGHT, display: "block" }} preserveAspectRatio="none" aria-hidden="true">
      <path d={areaPath} fill="var(--uikit-indigo-700)" fillOpacity={0.08} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--uikit-indigo-700)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r={3} fill="var(--uikit-indigo-700)" />
    </svg>
  );
}
