import type { ReactNode } from "react";

/** Bảng dày đặc, quét nhanh nhiều dòng — dùng cho danh sách member/organization/gap...
 * thay vì mỗi dòng 1 card to (đúng phản hồi: bảng dữ liệu dày đặc không hợp card). */
export function Table({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <table className="ui-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
