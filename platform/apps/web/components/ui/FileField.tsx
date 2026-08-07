function formatMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export interface FileFieldProps {
  label: string;
  hint?: string;
  accept?: string;
  required?: boolean;
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
  onChange: (file: File | null) => void;
  onValidationError?: (message: string) => void;
}

/** Validates size/type at selection time so the user finds out before waiting through an
 * upload, not after the server rejects it. */
export function FileField({
  label,
  hint,
  accept,
  required,
  maxSizeBytes,
  allowedMimeTypes,
  onChange,
  onValidationError,
}: FileFieldProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      onChange(null);
      return;
    }
    if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
      onValidationError?.("Định dạng tệp không được hỗ trợ — chỉ chấp nhận PDF, JPG hoặc PNG.");
      event.target.value = "";
      onChange(null);
      return;
    }
    if (maxSizeBytes && file.size > maxSizeBytes) {
      onValidationError?.(`Tệp vượt quá kích thước tối đa cho phép (${formatMB(maxSizeBytes)}).`);
      event.target.value = "";
      onChange(null);
      return;
    }
    onChange(file);
  }

  return (
    <label className="uikit-field">
      <span className="uikit-field__label">{label}</span>
      <input type="file" required={required} accept={accept} onChange={handleChange} />
      {hint && <span className="uikit-field__hint">{hint}</span>}
    </label>
  );
}
