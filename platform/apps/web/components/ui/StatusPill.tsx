import type { ReactNode } from "react";
import type { Tone } from "../../lib/tone";

export function StatusPill({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`uikit-pill uikit-pill--${tone}`}>
      <span className={`uikit-dot uikit-dot--${tone}`} />
      {children}
    </span>
  );
}
