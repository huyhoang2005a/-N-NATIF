import { FileText } from "lucide-react";

/** Chip trích dẫn — chỉ dùng ở nơi hiển thị bằng chứng thật có citation thật
 * (source/locator lấy từ dữ liệu API), không dùng trang trí. */
export function CitationChip({ source, locator }: { source: string; locator: string }) {
  return (
    <span className="uikit-chip">
      <FileText aria-hidden="true" />
      {source} <span className="uikit-chip__locator">· {locator}</span>
    </span>
  );
}
