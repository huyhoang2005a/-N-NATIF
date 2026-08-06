import type { ReactNode } from "react";

interface ProvenanceItem {
  id: string;
  claim: string;
  locator: string;
  action?: ReactNode;
}

/** Signature component của R2M (token system đã duyệt 2026-08-06): vệt định vị trích
 * dẫn chạy dọc bên trái, mỗi tick tương ứng 1 bằng chứng — ẩn dụ vạch chia caliper, gắn
 * thẳng vào bản chất "bằng chứng khoa học có thể truy vết nguồn" của sản phẩm. Dùng
 * nhất quán từ quy mô nhỏ (1 dòng rationale) tới lớn (cả section Evidence). */
export function ProvenanceRail({ items }: { items: ProvenanceItem[] }) {
  return (
    <div className="rail">
      {items.map((item) => (
        <div key={item.id} className="rail-item">
          <p className="rail-item__claim">{item.claim}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <span className="rail-item__locator">{item.locator}</span>
            {item.action}
          </div>
        </div>
      ))}
    </div>
  );
}
