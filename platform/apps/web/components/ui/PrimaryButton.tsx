import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type CommonProps = {
  children: React.ReactNode;
  full?: boolean;
  className?: string;
  icon?: LucideIcon;
};

export function PrimaryButton({
  full,
  className,
  icon: Icon,
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={["uikit-btn uikit-btn--primary", full ? "uikit-btn--full" : "", className].filter(Boolean).join(" ")}
    >
      {Icon && <Icon className="uikit-btn__icon" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function PrimaryButtonLink({ href, full, className, icon: Icon, children }: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={["uikit-btn uikit-btn--primary", full ? "uikit-btn--full" : "", className].filter(Boolean).join(" ")}
    >
      {Icon && <Icon className="uikit-btn__icon" aria-hidden="true" />}
      {children}
    </Link>
  );
}
