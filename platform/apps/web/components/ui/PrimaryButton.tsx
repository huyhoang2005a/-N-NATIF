import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

type CommonProps = {
  children: React.ReactNode;
  full?: boolean;
  className?: string;
};

export function PrimaryButton({
  full,
  className,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={["uikit-btn uikit-btn--primary", full ? "uikit-btn--full" : "", className].filter(Boolean).join(" ")}
    />
  );
}

export function PrimaryButtonLink({ href, full, className, children }: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={["uikit-btn uikit-btn--primary", full ? "uikit-btn--full" : "", className].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}
