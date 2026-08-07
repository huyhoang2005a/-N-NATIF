import type { Tone } from "../../lib/tone";

export function StatusDot({ tone = "gray", label }: { tone?: Tone; label: string }) {
  return (
    <span className="uikit-statusdot">
      <span className={`uikit-dot uikit-dot--${tone}`} />
      {label}
    </span>
  );
}
