import type { LucideIcon } from "lucide-react";
import type { MeResponse } from "@r2m/contracts";
import { Card } from "./Card";
import { Shell, type ShellNavItem } from "./Shell";

/** Khung trang "Sắp ra mắt" dùng chung cho các mục chưa có API thật (Phase 5
 * discovery, kiểm duyệt nội dung, danh mục tổ chức/người dùng toàn nền tảng...).
 * Không render dữ liệu giả — chỉ tiêu đề + icon + 1 dòng giải thích. */
export function SoonPage({
  title,
  description,
  icon: Icon,
  me,
  roleLabel,
  nav,
  brandLabel = "R2M",
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  me: MeResponse;
  roleLabel: string;
  nav: ShellNavItem[];
  brandLabel?: string;
}) {
  return (
    <Shell brandLabel={brandLabel} me={me} roleLabel={roleLabel} nav={nav}>
      <h1 style={{ fontSize: 22, marginBottom: "var(--space-5)" }}>{title}</h1>
      <Card>
        <div className="uikit-soon">
          <div className="uikit-soon__icon">
            <Icon aria-hidden="true" />
          </div>
          <p className="uikit-soon__title">Sắp ra mắt</p>
          <p>{description}</p>
        </div>
      </Card>
    </Shell>
  );
}
