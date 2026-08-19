export type Tone = "gray" | "blue" | "green" | "amber" | "red";

/**
 * Bảng mapping enum → tone, chốt cùng user trước khi code (xem plan
 * witty-scribbling-robin.md). Semantics: gray = trung tính/kết thúc không còn
 * hoạt động · blue = đang diễn ra/thông tin · green = tích cực/đã duyệt ·
 * amber = cần chú ý, không chặn · red = chặn cứng/nghiêm trọng/từ chối.
 *
 * GapSeverity: CRITICAL là tone riêng biệt duy nhất vì đây là mức chặn cứng
 * duyệt roadmap (ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS) — cần quét mắt nhận ra
 * ngay không cần đọc nhãn chữ. LOW/MEDIUM/HIGH đều không chặn gì nên có thể
 * dùng chung tone theo mức độ nhẹ hơn.
 */
export const GAP_SEVERITY_TONE: Record<string, Tone> = {
  LOW: "blue",
  MEDIUM: "amber",
  HIGH: "amber",
  CRITICAL: "red",
};

/** Suy từ 3 điểm neo có trong tham chiếu thiết kế 01-author.jsx: "Đang thu thập
 * bằng chứng" (EVIDENCE_COLLECTION) = blue, "Chờ duyệt lộ trình" (ROADMAP_DRAFT)
 * = amber, "Đã duyệt lộ trình" (ROADMAP_APPROVED) = green. */
export const TECHNOLOGY_CASE_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "gray",
  EVIDENCE_COLLECTION: "blue",
  UNDER_ASSESSMENT: "blue",
  GAP_IDENTIFIED: "amber",
  ROADMAP_DRAFT: "amber",
  ROADMAP_APPROVED: "green",
  PILOT_READY: "green",
  TRANSFER_READY: "green",
  COMMERCIALIZED: "green",
  ARCHIVED: "gray",
};

/** Tham chiếu neo SUBMITTED=blue qua nhãn "Đã nộp, chờ duyệt". */
export const ASSESSMENT_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  APPROVED: "green",
  SUPERSEDED: "gray",
};

/** Tham chiếu neo COMPLETED=green, IN_PROGRESS=blue, NOT_STARTED=gray. */
export const MILESTONE_STATUS_TONE: Record<string, Tone> = {
  NOT_STARTED: "gray",
  IN_PROGRESS: "blue",
  BLOCKED: "red",
  COMPLETED: "green",
  CANCELLED: "gray",
};

export const ORGANIZATION_STATUS_TONE: Record<string, Tone> = {
  PENDING_VERIFICATION: "amber",
  ACTIVE: "green",
  REJECTED: "red",
  SUSPENDED: "red",
  ARCHIVED: "gray",
};

/** Dùng chung cho org verification + author verification (cùng shape). */
export const VERIFICATION_REQUEST_STATUS_TONE: Record<string, Tone> = {
  PENDING: "amber",
  IN_REVIEW: "blue",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

/** `author_profile.verification_status` enum — `MeResponse.authorVerificationStatus`. */
export const AUTHOR_VERIFICATION_STATUS_TONE: Record<string, Tone> = {
  UNVERIFIED: "gray",
  PENDING: "amber",
  VERIFIED: "green",
  DECLINED: "red",
  SUSPENDED: "red",
};

/** GapStatus — độc lập với GapSeverity (severity = mức độ nghiêm trọng, status =
 * đang ở đâu trong vòng đời xử lý). OPEN=amber vì mới phát sinh, cần triage —
 * tín hiệu "chặn cứng" đã do GapSeverity=CRITICAL đảm nhiệm riêng. */
export const GAP_STATUS_TONE: Record<string, Tone> = {
  OPEN: "amber",
  IN_PROGRESS: "blue",
  RESOLVED: "green",
  ACCEPTED_RISK: "gray",
  CLOSED: "gray",
};

/** RoadmapStatus (cấp roadmap, khác MilestoneStatus). */
export const ROADMAP_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "gray",
  IN_REVIEW: "blue",
  APPROVED: "green",
  ACTIVE: "green",
  COMPLETED: "green",
  REJECTED: "red",
  SUPERSEDED: "gray",
};

export const ROADMAP_REVIEW_DECISION_TONE: Record<string, Tone> = {
  APPROVED: "green",
  REJECTED: "red",
  CHANGES_REQUESTED: "amber",
};

export const TASK_STATUS_TONE: Record<string, Tone> = {
  TODO: "gray",
  IN_PROGRESS: "blue",
  BLOCKED: "red",
  DONE: "green",
  CANCELLED: "gray",
};

/** ResearchNeedStatus — OPEN=green (đang nhận đề xuất, trạng thái "hoạt động"
 * mong muốn, khác các domain khác nơi green nghĩa là "đã hoàn tất"), PAUSED=amber
 * (tạm dừng, cần chú ý), CLOSED/ARCHIVED=gray (kết thúc vòng đời). */
export const NEED_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "gray",
  OPEN: "green",
  PAUSED: "amber",
  CLOSED: "gray",
  ARCHIVED: "gray",
};

/** ProposalStatus — anchored on the same 3-point pattern as the rest of this file:
 * SUBMITTED=blue (đã nộp, chờ xử lý, tương tự ASSESSMENT_STATUS_TONE.SUBMITTED),
 * UNDER_REVIEW=amber (đang cần công ty xử lý), ACCEPTED=green, REJECTED=red,
 * WITHDRAWN=gray (tác giả tự rút, kết thúc trung tính). */
export const PROPOSAL_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  UNDER_REVIEW: "amber",
  ACCEPTED: "green",
  REJECTED: "red",
  WITHDRAWN: "gray",
};

export const CASE_INITIATION_STATUS_TONE: Record<string, Tone> = {
  PENDING: "amber",
  ACCEPTED: "green",
  DECLINED: "red",
  CANCELLED: "gray",
  EXPIRED: "gray",
};

export const TRANSFER_MANIFEST_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "gray",
  READY: "blue",
  SHARED: "green",
  EXPIRED: "gray",
  REVOKED: "red",
};

export const CONTENT_FLAG_STATUS_TONE: Record<string, Tone> = {
  PENDING: "amber",
  IN_REVIEW: "blue",
  CLOSED: "gray",
  DISMISSED: "gray",
};

/** `user_status` enum — used by `/platform/users`. */
export const USER_STATUS_TONE: Record<string, Tone> = {
  INVITED: "amber",
  ACTIVE: "green",
  SUSPENDED: "red",
  DEACTIVATED: "gray",
};

export function toneOf(map: Record<string, Tone>, value: string): Tone {
  return map[value] ?? "gray";
}
