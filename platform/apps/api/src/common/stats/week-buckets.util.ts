const WEEK_COUNT = 12;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Shared by every `.../stats` endpoint (organizations, users, ...) that charts weekly
 * signups on the admin dashboard — one zero-fill rule so every growth chart has the same
 * exact 12 Monday-aligned week starts, regardless of which rows the DB happened to
 * return. `rows` come from a `date_trunc('week', created_at)::date` GROUP BY, so
 * `weekStart` is already a `YYYY-MM-DD` string at UTC midnight Monday — matched here by
 * string equality, not date math, to avoid timezone drift between Postgres and Node. */
export function zeroFillWeeklySignups(rows: { weekStart: string; count: number }[]): { weekStart: string; count: number }[] {
  const countsByWeek = new Map(rows.map((row) => [row.weekStart, row.count]));

  const mostRecentMonday = new Date();
  const dayOfWeek = mostRecentMonday.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  mostRecentMonday.setUTCHours(0, 0, 0, 0);
  mostRecentMonday.setUTCDate(mostRecentMonday.getUTCDate() - daysSinceMonday);

  const weeks: { weekStart: string; count: number }[] = [];
  for (let i = WEEK_COUNT - 1; i >= 0; i--) {
    const weekStartDate = new Date(mostRecentMonday.getTime() - i * MS_PER_WEEK);
    const weekStart = weekStartDate.toISOString().slice(0, 10);
    weeks.push({ weekStart, count: countsByWeek.get(weekStart) ?? 0 });
  }
  return weeks;
}
