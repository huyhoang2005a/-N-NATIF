import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/** Nút hành động — KHÔNG BAO GIỜ gạch chân (đúng phản hồi: gạch chân chỉ dành cho
 * `TextLink`, dùng cho link chữ giữa câu, không phải cho hành động). */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  const classes = ["ui-btn", `ui-btn--${variant}`, size === "sm" ? "ui-btn--sm" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}

/** Biến thể điều hướng của Button — vẫn không gạch chân, chỉ khác nó render `<a>`. */
export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
}: CommonProps & { href: string; className?: string }) {
  const classes = ["ui-btn", `ui-btn--${variant}`, size === "sm" ? "ui-btn--sm" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/** Link chữ giữa câu/điều hướng phụ — DUY NHẤT nơi có gạch chân trong hệ thống. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={["ui-link", className].filter(Boolean).join(" ")}>
      {children}
    </Link>
  );
}
