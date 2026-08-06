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
    <section className={["ui-card", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="ui-card__header">
      <span className="ui-card__title">{title}</span>
      {action}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="ui-card__body">{children}</div>;
}

/** 2 card song song (Overview + Readiness Snapshot trên trang Case Detail) — xếp dọc
 * trên mobile. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="ui-card-grid">{children}</div>;
}
