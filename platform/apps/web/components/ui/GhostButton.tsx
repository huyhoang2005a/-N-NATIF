import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function GhostButton({
  children,
  tone = "slate",
  className,
  icon: Icon,
  ...rest
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "red";
  className?: string;
  icon?: LucideIcon;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={["uikit-btn", `uikit-btn--ghost-${tone}`, className].filter(Boolean).join(" ")}
    >
      {Icon && <Icon className="uikit-btn__icon" aria-hidden="true" />}
      {children}
    </button>
  );
}
