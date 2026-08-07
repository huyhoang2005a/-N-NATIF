import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: "slate" | "indigo" | "amber" | "rose" | "green";
  hint?: string;
}) {
  return (
    <div className="uikit-card uikit-statcard">
      <div className={`uikit-statcard__icon uikit-statcard__icon--${tone}`}>
        <Icon aria-hidden="true" />
      </div>
      <div>
        <p className="uikit-statcard__value">{value}</p>
        <p className="uikit-statcard__label">{label}</p>
        {hint && <p className="uikit-statcard__hint">{hint}</p>}
      </div>
    </div>
  );
}
