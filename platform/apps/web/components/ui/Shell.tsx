"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MeResponse, NotificationResponse } from "@r2m/contracts";
import { apiFetch, authFetch } from "../../lib/api-client";
import { clearTokens } from "../../lib/session";
import { BrandMark } from "./BrandMark";

export interface ShellNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    authFetch<NotificationResponse[]>("/notifications?status=UNREAD")
      .then((rows) => setUnreadCount(rows.length))
      .catch(() => {
        // Badge chuông là tiện ích phụ, không chặn render Shell nếu request lỗi
        // (vd session sắp hết hạn) — trang gọi Shell đã tự xử lý session riêng.
      });
  }, [pathname]);

  async function onLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // logout là no-op phía server (JWT không lưu session) — vẫn xoá session cục bộ.
    }
    clearTokens();
    router.push("/login");
  }

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const term = searchTerm.trim();
    router.push(term ? `/resources?q=${encodeURIComponent(term)}` : "/resources");
  }

  const initials = me.displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

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
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`uikit-sidebar__link ${active ? "uikit-sidebar__link--active" : ""}`}
              >
                <Icon className="uikit-sidebar__icon" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="uikit-shell__main">
        <div className="uikit-topbar">
          <form onSubmit={onSearchSubmit} className="uikit-search">
            <Search className="uikit-search__icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Tìm tài nguyên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>
          <div className="uikit-topbar__right">
            <span className="uikit-topbar__role">{roleLabel}</span>
            <Link href="/notifications" className="uikit-topbar__icon-btn" aria-label="Thông báo" title="Thông báo">
              <Bell aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="uikit-topbar__icon-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </Link>
            <span className="uikit-topbar__user">{me.displayName}</span>
            <div className="uikit-avatar" aria-hidden="true">
              {initials || "?"}
            </div>
            <button type="button" className="uikit-topbar__logout" onClick={onLogout} title="Đăng xuất">
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </div>
        <main className="uikit-main">{children}</main>
      </div>
    </div>
  );
}
