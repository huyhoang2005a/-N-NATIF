import { TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "./Sparkline";

/** KPI card with an embedded trend sparkline + month-over-month delta — the admin
 * dashboard's headline metrics (new users, new organizations, ...). A pure directional
 * indicator (▲ green / ▼ red for "value went up/down vs last month"), not a per-metric
 * "is this good" judgement — same simplification the Power BI reference this was modeled
 * on uses. `values` is the 6-month series feeding the sparkline; `deltaPct` is computed by
 * the caller from the same series (last vs second-to-last month) so there's one source of
 * truth for both. */
export function KpiTrendCard({
  label,
  value,
  values,
  deltaPct,
}: {
  label: string;
  value: string;
  values: number[];
  deltaPct: number | null;
}) {
  const isUp = deltaPct !== null && deltaPct >= 0;
  const DeltaIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <div className="uikit-card uikit-kpicard">
      <div>
        <p className="uikit-kpicard__value">{value}</p>
        <p className="uikit-kpicard__label">{label}</p>
      </div>
      <div className="uikit-kpicard__spark">
        <Sparkline values={values} />
      </div>
      <p className={`uikit-kpicard__delta ${deltaPct !== null ? `uikit-kpicard__delta--${isUp ? "up" : "down"}` : "uikit-kpicard__delta--muted"}`}>
        {deltaPct !== null ? (
          <>
            <DeltaIcon size={13} aria-hidden="true" />
            {Math.abs(deltaPct).toFixed(1)}% so với tháng trước
          </>
        ) : (
          "Chưa đủ dữ liệu để so sánh"
        )}
      </p>
    </div>
  );
}
