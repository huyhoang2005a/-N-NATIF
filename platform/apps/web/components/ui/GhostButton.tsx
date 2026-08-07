import type { ButtonHTMLAttributes, ReactNode } from "react";

export function GhostButton({
  children,
  tone = "slate",
  className,
  ...rest
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "red";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={["uikit-btn", `uikit-btn--ghost-${tone}`, className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}
