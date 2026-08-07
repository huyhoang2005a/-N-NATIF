import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type BaseProps = {
  label: string;
  hint?: string;
  optional?: boolean;
};

type InputProps = BaseProps & { as?: undefined } & InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = BaseProps & { as: "textarea" } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextField(props: InputProps | TextareaProps) {
  const { label, hint, optional, ...rest } = props;
  return (
    <label className="uikit-field">
      <span className="uikit-field__label">
        {label}
        {optional && <span className="uikit-field__optional"> · tuỳ chọn</span>}
      </span>
      {props.as === "textarea" ? (
        <textarea rows={3} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && <span className="uikit-field__hint">{hint}</span>}
    </label>
  );
}
