export type StatusTone = "ok" | "pending" | "danger" | "neutral";

/** Badge trạng thái dùng chung cho MỌI enum status trong hệ thống (case, assessment,
 * gap, roadmap, verification...) — không tự suy diễn màu riêng theo từng trang. `tone`
 * do các hàm `xxxTone()` trong `lib/labels.ts` ánh xạ từ giá trị enum thật.
 *
 * `danger` LUÔN kèm icon ⚠ (không chỉ dựa màu) — bắt buộc theo token system đã duyệt,
 * để CRITICAL/REJECTED/SUSPENDED không lẫn với trạng thái bình thường kể cả khi không
 * phân biệt được màu (accessibility). */
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`ui-badge ui-badge--${tone}`}>
      {tone === "danger" && <span aria-hidden="true">⚠</span>}
      {label}
    </span>
  );
}
