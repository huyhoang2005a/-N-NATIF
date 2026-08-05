import type { RegisterOrganizationRequest } from "@r2m/contracts";

export const ORG_TYPE_LABELS: Record<RegisterOrganizationRequest["organizationType"], string> = {
  RESEARCH_UNIT: "Đơn vị nghiên cứu",
  ENTERPRISE: "Doanh nghiệp",
  GOVERNMENT: "Cơ quan nhà nước",
  SUPPORT_ORGANIZATION: "Tổ chức hỗ trợ",
};

export const ORG_STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: "Chờ xác minh",
  ACTIVE: "Đang hoạt động",
  REJECTED: "Bị từ chối",
  SUSPENDED: "Tạm khoá",
  ARCHIVED: "Lưu trữ",
};

export const PLATFORM_ROLE_LABELS: Record<string, string> = {
  USER: "Thành viên",
  PLATFORM_REVIEWER: "Chuyên viên thẩm định",
  PLATFORM_ADMIN: "Quản trị nền tảng",
};

export function orgStatusBadgeClass(status: string): string {
  if (status === "ACTIVE") return "badge badge-active";
  if (status === "REJECTED" || status === "SUSPENDED") return "badge badge-negative";
  return "badge badge-pending";
}

export const VERIFICATION_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chưa ai nhận",
  IN_REVIEW: "Đang được xử lý",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã huỷ",
};
