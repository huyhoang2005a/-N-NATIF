import type { ReactNode } from "react";

export function FormField({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {optional && <span className="field__optional"> · tuỳ chọn</span>}
      </span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
