/** `GET /platform/dashboard-stats` — admin-only. 6 months of zero-filled monthly volume
 * counts, powering the admin dashboard's KPI trend cards (sparkline + month-over-month %)
 * and trend charts. Deliberately separate from `PlatformOrganizationStatsResponse` /
 * `PlatformUserStatsResponse` / `PlatformCaseSummaryResponse` (weekly signups, byType/
 * byStatus breakdowns) — those already exist and the dashboard still fetches them directly;
 * this endpoint only adds the monthly time series those don't cover. */
export interface PlatformDashboardMonthlyPoint {
  /** `YYYY-MM-01`, UTC. */
  month: string;
  newUsers: number;
  newOrganizations: number;
  newTechnologyCases: number;
  newResources: number;
  /** Verification decisions (org + author combined) made in that month — the ratio of
   * `verificationsApproved / (verificationsApproved + verificationsRejected)` is the
   * dashboard's "approval rate" KPI, the one rate-type metric alongside 4 volume metrics. */
  verificationsApproved: number;
  verificationsRejected: number;
}

export interface PlatformDashboardResponse {
  monthly: PlatformDashboardMonthlyPoint[];
}
