import type { SelectHTMLAttributes } from "react";

export function SelectField({
  label,
  hint,
  optional,
  options,
  ...rest
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  options: { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="uikit-field">
      <span className="uikit-field__label">
        {label}
        {optional && <span className="uikit-field__optional"> · tuỳ chọn</span>}
      </span>
      <select {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="uikit-field__hint">{hint}</span>}
    </label>
  );
}
