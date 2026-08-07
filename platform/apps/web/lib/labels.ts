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

export const ORG_VERIFICATION_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TAX_DOCUMENT: "Giấy tờ thuế",
  ORGANIZATION_LETTER: "Thư xác nhận của tổ chức",
};

// ---------- Phase 2: Resource ----------

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  PAPER: "Bài báo",
  REPORT: "Báo cáo",
  DATASET: "Bộ dữ liệu",
  MODEL: "Mô hình",
  CHECKPOINT: "Checkpoint mô hình",
  SOURCE_CODE: "Mã nguồn",
  PATENT: "Bằng sáng chế",
  LICENSE: "Giấy phép",
  ARCHITECTURE_DOCUMENT: "Tài liệu kiến trúc",
  EXPERIMENT_RESULT: "Kết quả thực nghiệm",
  PILOT_EVIDENCE: "Bằng chứng thí điểm",
  VIDEO: "Video",
  OTHER: "Khác",
};

export const RESOURCE_ACCESS_LEVEL_LABELS: Record<string, string> = {
  PUBLIC: "Công khai",
  ORGANIZATION: "Theo tổ chức",
  CASE_ONLY: "Chỉ trong case",
  APPROVAL_REQUIRED: "Cần cấp quyền",
  PRIVATE: "Riêng tư",
};

// ---------- Phase 3: Technology Case ----------

export const TECHNOLOGY_CASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  EVIDENCE_COLLECTION: "Đang thu thập bằng chứng",
  UNDER_ASSESSMENT: "Đang đánh giá",
  GAP_IDENTIFIED: "Đã xác định khoảng trống",
  ROADMAP_DRAFT: "Đang soạn lộ trình",
  ROADMAP_APPROVED: "Lộ trình đã duyệt",
  PILOT_READY: "Sẵn sàng thí điểm",
  TRANSFER_READY: "Sẵn sàng chuyển giao",
  COMMERCIALIZED: "Đã thương mại hoá",
  ARCHIVED: "Lưu trữ",
};

export function technologyCaseStatusBadgeClass(status: string): string {
  if (["ROADMAP_APPROVED", "PILOT_READY", "TRANSFER_READY", "COMMERCIALIZED"].includes(status)) {
    return "badge badge-active";
  }
  if (status === "ARCHIVED") return "badge badge-negative";
  return "badge badge-pending";
}

export const CASE_MEMBER_ROLE_LABELS: Record<string, string> = {
  OWNER: "Chủ trì",
  TECHNICAL_MEMBER: "Thành viên kỹ thuật",
  CASE_REVIEWER: "Người thẩm định",
  PARTNER_MEMBER: "Thành viên đối tác",
  VIEWER: "Chỉ xem",
};

export const CASE_MEMBER_STATUS_LABELS: Record<string, string> = {
  INVITED: "Đã mời",
  ACTIVE: "Đang hoạt động",
  SUSPENDED: "Tạm khoá",
  LEFT: "Đã rời",
};

export const CASE_ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  OWNING_ORGANIZATION: "Tổ chức chủ trì",
  PARTNER_COMPANY: "Doanh nghiệp đối tác",
  REVIEW_ORGANIZATION: "Tổ chức thẩm định",
  SUPPORT_ORGANIZATION: "Tổ chức hỗ trợ",
};

export const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang hiệu lực",
  SUPERSEDED: "Đã thay thế",
  REJECTED: "Bị từ chối",
};

// ---------- Phase 4: Assessment ----------

export const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp, chờ duyệt",
  APPROVED: "Đã duyệt",
  SUPERSEDED: "Đã bị thay thế",
};

export function assessmentStatusBadgeClass(status: string): string {
  if (status === "APPROVED") return "badge badge-active";
  if (status === "SUPERSEDED") return "badge badge-negative";
  return "badge badge-pending";
}

// ---------- Phase 4: Gap ----------

export const GAP_SEVERITY_LABELS: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Nghiêm trọng",
};

export function gapSeverityBadgeClass(severity: string): string {
  if (severity === "CRITICAL" || severity === "HIGH") return "badge badge-negative";
  if (severity === "MEDIUM") return "badge badge-pending";
  return "badge";
}

export const GAP_STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang mở",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  ACCEPTED_RISK: "Chấp nhận rủi ro",
  CLOSED: "Đã đóng",
};

export function gapStatusBadgeClass(status: string): string {
  if (status === "RESOLVED" || status === "CLOSED") return "badge badge-active";
  if (status === "OPEN") return "badge badge-negative";
  return "badge badge-pending";
}

// ---------- Phase 4: Roadmap ----------

export const ROADMAP_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  IN_REVIEW: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  ACTIVE: "Đang triển khai",
  COMPLETED: "Đã hoàn thành",
  REJECTED: "Bị từ chối",
  SUPERSEDED: "Đã bị thay thế",
};

export function roadmapStatusBadgeClass(status: string): string {
  if (["APPROVED", "ACTIVE", "COMPLETED"].includes(status)) return "badge badge-active";
  if (status === "REJECTED" || status === "SUPERSEDED") return "badge badge-negative";
  return "badge badge-pending";
}

export const ROADMAP_REVIEW_DECISION_LABELS: Record<string, string> = {
  APPROVED: "Duyệt",
  REJECTED: "Từ chối",
  CHANGES_REQUESTED: "Yêu cầu chỉnh sửa",
};

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  BLOCKED: "Bị chặn",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã huỷ",
};

export function milestoneStatusBadgeClass(status: string): string {
  if (status === "COMPLETED") return "badge badge-active";
  if (status === "BLOCKED" || status === "CANCELLED") return "badge badge-negative";
  return "badge badge-pending";
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "Chưa làm",
  IN_PROGRESS: "Đang làm",
  BLOCKED: "Bị chặn",
  DONE: "Đã xong",
  CANCELLED: "Đã huỷ",
};

export function taskStatusBadgeClass(status: string): string {
  if (status === "DONE") return "badge badge-active";
  if (status === "BLOCKED" || status === "CANCELLED") return "badge badge-negative";
  return "badge badge-pending";
}

export const PRIORITY_LEVEL_LABELS: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Khẩn cấp",
};

export const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
  FINISH_TO_START: "Kết thúc trước → Bắt đầu sau",
  START_TO_START: "Bắt đầu cùng lúc",
  FINISH_TO_FINISH: "Kết thúc cùng lúc",
  START_TO_FINISH: "Bắt đầu trước → Kết thúc sau",
};

