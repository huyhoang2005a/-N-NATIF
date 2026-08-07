import type { ReactNode } from "react";
import Link from "next/link";

export function SectionHeader({
  title,
  action,
  onAction,
  href,
}: {
  title: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
  href?: string;
}) {
  return (
    <div className="uikit-section-header">
      <h2 className="uikit-section-header__title">{title}</h2>
      {action &&
        (href ? (
          <Link href={href} className="uikit-section-header__action">
            {action} →
          </Link>
        ) : (
          <button type="button" onClick={onAction} className="uikit-section-header__action">
            {action} →
          </button>
        ))}
    </div>
  );
}
