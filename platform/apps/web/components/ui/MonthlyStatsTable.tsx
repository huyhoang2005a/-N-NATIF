import type { PlatformDashboardMonthlyPoint } from "@r2m/contracts";

const MONTH_LABELS_VI = [
  "Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12",
];

function formatMonthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${MONTH_LABELS_VI[d.getUTCMonth()] ?? iso} ${d.getUTCFullYear()}`;
}

/** A numeric column with an inline data-bar background sized to its own column's max —
 * same single-indigo sequential-magnitude treatment as `CategoryBarChart`, just drawn as a
 * cell background instead of a separate bar row (the "data bar table" form from the Power
 * BI reference this dashboard was modeled on, without that reference's red/green traffic-
 * light gradient — there's no "high delivery time is bad" style threshold semantic for a
 * pure volume count, so a status-color scale would be inventing meaning that isn't there). */
function DataBarCell({ value, max }: { value: number; max: number }) {
  const widthPct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <td style={{ padding: 0 }}>
      <div style={{ position: "relative", padding: "var(--space-2) var(--space-3)" }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "4px",
            right: `${100 - widthPct}%`,
            background: "var(--uikit-indigo-50)",
            borderRadius: "var(--radius-sm)",
          }}
        />
        <span
          style={{
            position: "relative",
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            color: "var(--uikit-slate-900)",
          }}
        >
          {value.toLocaleString("vi-VN")}
        </span>
      </div>
    </td>
  );
}

export function MonthlyStatsTable({ rows }: { rows: PlatformDashboardMonthlyPoint[] }) {
  const maxUsers = Math.max(1, ...rows.map((r) => r.newUsers));
  const maxOrgs = Math.max(1, ...rows.map((r) => r.newOrganizations));
  const maxCases = Math.max(1, ...rows.map((r) => r.newTechnologyCases));
  const maxResources = Math.max(1, ...rows.map((r) => r.newResources));

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="uikit-table">
        <thead>
          <tr>
            <th>Tháng</th>
            <th>Người dùng mới</th>
            <th>Tổ chức mới</th>
            <th>Case mới</th>
            <th>Tài nguyên mới</th>
            <th>Tỷ lệ duyệt hồ sơ</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((row) => {
            const decided = row.verificationsApproved + row.verificationsRejected;
            const approvalRate = decided > 0 ? (row.verificationsApproved / decided) * 100 : null;
            return (
              <tr key={row.month}>
                <td style={{ fontSize: 13, fontWeight: 500, color: "var(--uikit-slate-700)", whiteSpace: "nowrap" }}>
                  {formatMonthLabel(row.month)}
                </td>
                <DataBarCell value={row.newUsers} max={maxUsers} />
                <DataBarCell value={row.newOrganizations} max={maxOrgs} />
                <DataBarCell value={row.newTechnologyCases} max={maxCases} />
                <DataBarCell value={row.newResources} max={maxResources} />
                <td style={{ fontSize: 13, color: "var(--uikit-slate-700)", fontVariantNumeric: "tabular-nums" }}>
                  {approvalRate === null ? "—" : `${approvalRate.toFixed(0)}% (${decided} hồ sơ)`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
