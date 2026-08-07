"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MeResponse } from "@r2m/contracts";
import { apiFetch } from "../../lib/api-client";
import { clearTokens } from "../../lib/session";
import { BrandMark } from "./BrandMark";

export interface ShellNavItem {
  label: string;
  href: string;
}

/** Khung ứng dụng nội bộ (sidebar + top bar) dùng ở mọi trang đã đăng nhập.
 * KHÔNG có nút chuyển vai trò — `nav`/`roleLabel` do trang gọi truyền vào,
 * tính từ role thật của actor (platformRole/organization_member/case_member),
 * không phải state lựa chọn. */
export function Shell({
  brandLabel,
  nav,
  me,
  roleLabel,
  children,
}: {
  brandLabel: string;
  nav: ShellNavItem[];
  me: MeResponse;
  roleLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function onLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // logout là no-op phía server (JWT không lưu session) — vẫn xoá session cục bộ.
    }
    clearTokens();
    router.push("/login");
  }

  return (
    <div className="uikit-shell">
      <aside className="uikit-sidebar">
        <Link href="/dashboard" className="uikit-sidebar__brand">
          <BrandMark />
          <span>{brandLabel}</span>
        </Link>
        <nav className="uikit-sidebar__nav">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`uikit-sidebar__link ${active ? "uikit-sidebar__link--active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="uikit-shell__main">
        <div className="uikit-topbar">
          <span className="uikit-topbar__role">{roleLabel}</span>
          <span className="uikit-topbar__user">{me.displayName}</span>
          <button type="button" className="uikit-topbar__logout" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
        <main className="uikit-main">{children}</main>
      </div>
    </div>
  );
}
