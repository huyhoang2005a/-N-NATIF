import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={["uikit-card", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}
