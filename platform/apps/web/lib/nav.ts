import {
  Bell,
  Bookmark,
  Building2,
  ClipboardCheck,
  Database,
  FolderOpen,
  Flag,
  Handshake,
  LayoutDashboard,
  Rss,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import type { MeResponse, OrganizationResponse } from "@r2m/contracts";
import type { ShellNavItem } from "../components/ui";

export type Persona = "platform-ops" | "company" | "author";

/** Suy ra không gian làm việc hiển thị cho actor — KHÔNG phải lựa chọn thủ công.
 * `platformRole` quyết định trước (REVIEWER/ADMIN luôn vào không gian vận hành
 * nền tảng); còn lại (USER) suy theo loại tổ chức chính (tổ chức đầu tiên actor
 * là thành viên) — ENTERPRISE/GOVERNMENT/SUPPORT_ORGANIZATION => doanh nghiệp,
 * RESEARCH_UNIT hoặc chưa có tổ chức nào => tác giả (mặc định). */
export function personaOf(me: MeResponse, organizations: OrganizationResponse[]): Persona {
  if (me.platformRole === "PLATFORM_REVIEWER" || me.platformRole === "PLATFORM_ADMIN") {
    return "platform-ops";
  }
  const primaryOrg = organizations[0];
  if (primaryOrg && primaryOrg.type !== "RESEARCH_UNIT") {
    return "company";
  }
  return "author";
}

export const AUTHOR_NAV: ShellNavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Bảng tin", href: "/activity-feed", icon: Rss },
  { label: "Tài nguyên", href: "/resources", icon: Database },
  { label: "Case của tôi", href: "/technology-cases", icon: FolderOpen },
  { label: "Đề xuất", href: "/proposals", icon: Send },
  { label: "Yêu cầu khởi tạo case", href: "/case-initiation-requests", icon: Handshake },
  { label: "Thông báo", href: "/notifications", icon: Bell },
  { label: "Đã lưu", href: "/saved", icon: Bookmark },
  { label: "Hồ sơ", href: "/profile", icon: User },
];

export const COMPANY_NAV: ShellNavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Bảng tin", href: "/activity-feed", icon: Rss },
  { label: "Nhu cầu nghiên cứu", href: "/needs", icon: Target },
  { label: "Gợi ý công nghệ", href: "/recommendations", icon: Sparkles },
  { label: "Đề xuất nhận được", href: "/proposals-received", icon: Send },
  { label: "Case của tôi", href: "/technology-cases", icon: FolderOpen },
  { label: "Đã lưu", href: "/saved", icon: Bookmark },
  { label: "Hồ sơ", href: "/profile", icon: User },
];

const PLATFORM_OPS_NAV_BASE: ShellNavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Xác minh tổ chức", href: "/platform/organization-verifications", icon: ShieldCheck },
  { label: "Xác minh tác giả", href: "/platform/author-verifications", icon: UserCheck },
  { label: "Duyệt đánh giá & lộ trình", href: "/platform/reviews", icon: ClipboardCheck },
  { label: "Kiểm duyệt", href: "/platform/flags", icon: Flag },
  { label: "Hồ sơ", href: "/profile", icon: User },
];

const PLATFORM_ADMIN_EXTRA_NAV: ShellNavItem[] = [
  { label: "Tổ chức", href: "/platform/organizations", icon: Building2 },
  { label: "Người dùng", href: "/platform/users", icon: Users },
];

/** Admin có thêm 2 mục quản trị tổ chức/người dùng so với reviewer — cả 2 mục
 * đó hiện chưa có API "list tất cả" (chỉ /organizations trả về tổ chức actor
 * là thành viên) nên trang đích là "Sắp ra mắt", không phải dữ liệu giả. */
export function platformOpsNav(isAdmin: boolean): ShellNavItem[] {
  return isAdmin ? [...PLATFORM_OPS_NAV_BASE.slice(0, -1), ...PLATFORM_ADMIN_EXTRA_NAV, PLATFORM_OPS_NAV_BASE.at(-1)!] : PLATFORM_OPS_NAV_BASE;
}

export function navForPersona(persona: Persona, isAdmin: boolean): ShellNavItem[] {
  if (persona === "platform-ops") return platformOpsNav(isAdmin);
  if (persona === "company") return COMPANY_NAV;
  return AUTHOR_NAV;
}
