import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

/** `href` renders the outer element as `<Link>` instead of `<div>` — same tag swap
 * approach as `PrimaryButton`/`PrimaryButtonLink`, not a wrapping `<Link>` around a
 * `<div>`. Wrapping caused real layout drift in a grid (nested block-in-anchor sizing
 * inconsistency between clickable and non-clickable cards) — this keeps the box model
 * byte-identical either way. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: "slate" | "indigo" | "amber" | "rose" | "green";
  hint?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className={`uikit-statcard__icon uikit-statcard__icon--${tone}`}>
        <Icon aria-hidden="true" />
      </div>
      <div>
        <p className="uikit-statcard__value">{value}</p>
        <p className="uikit-statcard__label">{label}</p>
        {hint && <p className="uikit-statcard__hint">{hint}</p>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="uikit-card uikit-statcard uikit-statcard--link">
        {content}
      </Link>
    );
  }

  return <div className="uikit-card uikit-statcard">{content}</div>;
}
