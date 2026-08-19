const MONTH_COUNT = 6;

/** Monthly counterpart to `zeroFillWeeklySignups` — same reasoning (stable x-axis
 * regardless of which months the DB happened to return rows for), just month-grained for
 * the platform admin dashboard's KPI trend cards/charts (6 months is enough to show a
 * trend without the chart going stale-looking on a young dataset). `rows` come from a
 * `date_trunc('month', created_at)::date` GROUP BY, so `month` is already `YYYY-MM-01` —
 * matched by string equality, not date math, for the same Postgres/Node timezone-drift
 * reason as the weekly version. */
export function zeroFillMonthly<T extends Record<string, number>>(
  rows: ({ month: string } & T)[],
  zeroRow: T,
): ({ month: string } & T)[] {
  const rowsByMonth = new Map(rows.map((row) => [row.month, row]));

  const firstOfThisMonth = new Date();
  firstOfThisMonth.setUTCHours(0, 0, 0, 0);
  firstOfThisMonth.setUTCDate(1);

  const months: ({ month: string } & T)[] = [];
  for (let i = MONTH_COUNT - 1; i >= 0; i--) {
    const monthDate = new Date(
      Date.UTC(firstOfThisMonth.getUTCFullYear(), firstOfThisMonth.getUTCMonth() - i, 1),
    );
    const month = monthDate.toISOString().slice(0, 10);
    months.push(rowsByMonth.get(month) ?? { month, ...zeroRow });
  }
  return months;
}
