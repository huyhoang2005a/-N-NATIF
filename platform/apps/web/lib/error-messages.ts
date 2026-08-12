/** Server error codes are stable (CLAUDE.md "Error code ổn định"); the raw `message` text
 * from the API is English and meant for logs, not end users — map codes to Vietnamese copy
 * here instead of surfacing `error.message` directly in the UI. */
const ERROR_MESSAGES_VI: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  AUTH_ACCOUNT_SUSPENDED: "Tài khoản đã bị tạm khoá.",
  AUTH_UNAUTHENTICATED: "Vui lòng đăng nhập để tiếp tục.",
  AUTH_EMAIL_ALREADY_REGISTERED: "Email này đã được đăng ký cho một tài khoản khác.",
  AUTH_FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  AUTH_INVALID_REFRESH_TOKEN: "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.",
  AUTH_CURRENT_PASSWORD_INVALID: "Mật khẩu hiện tại không đúng.",
  ORG_ALREADY_EXISTS: "Tên tổ chức hoặc domain email này đã được đăng ký cho một tổ chức khác.",
  ORG_NOT_FOUND: "Không tìm thấy tổ chức này.",
  ORG_NOT_ACTIVE: "Tổ chức chưa được kích hoạt.",
  ORG_INVALID_TRANSITION: "Không thể chuyển tổ chức sang trạng thái này lúc này.",
  ORG_VERSION_CONFLICT: "Dữ liệu tổ chức vừa được cập nhật ở nơi khác, vui lòng tải lại.",
  ORG_CANNOT_REMOVE_LAST_OWNER: "Không thể xoá chủ sở hữu cuối cùng của tổ chức.",
  ORG_MEMBER_ALREADY_EXISTS: "Người này đã là thành viên của tổ chức.",
  ORG_MEMBER_NOT_FOUND: "Không tìm thấy thành viên này trong tổ chức.",
  ORG_NOT_MEMBER: "Bạn không phải là thành viên của tổ chức này.",
  VERIFICATION_ALREADY_PENDING: "Đã có một yêu cầu xác minh đang chờ xử lý.",
  VERIFICATION_REQUEST_NOT_FOUND: "Không tìm thấy yêu cầu xác minh này.",
  VERIFICATION_REQUEST_CONFLICT: "Yêu cầu xác minh đã được xử lý hoặc không còn hiệu lực.",
  VERIFICATION_REVIEWER_IS_SUBMITTER: "Bạn không thể tự duyệt yêu cầu do chính mình nộp.",
  VERIFICATION_REASON_REQUIRED: "Vui lòng nhập lý do khi từ chối.",
  VERIFICATION_INVALID_TRANSITION: "Không thể chuyển yêu cầu xác minh sang trạng thái này lúc này.",
  VERIFICATION_MISSING_DOCUMENT: "Cần đính kèm ít nhất 1 tài liệu (Giấy tờ thuế hoặc Thư xác nhận của tổ chức).",
  AUTH_EMAIL_NOT_VERIFIED: "Vui lòng xác thực email trước khi thực hiện thao tác này.",
  AUTH_EMAIL_VERIFICATION_TOKEN_INVALID: "Liên kết xác thực không hợp lệ hoặc đã được sử dụng.",
  AUTH_EMAIL_VERIFICATION_TOKEN_EXPIRED: "Liên kết xác thực đã hết hạn.",
  AUTH_EMAIL_VERIFICATION_RATE_LIMITED: "Bạn vừa gửi email xác thực gần đây, vui lòng đợi thêm.",
  SYSTEM_IDEMPOTENCY_KEY_REUSED: "Yêu cầu này đã được xử lý trước đó.",
  AUTHOR_ALREADY_VERIFIED: "Tài khoản của bạn đã được xác minh là tác giả.",
  AUTHOR_VERIFICATION_DOCUMENT_INVALID: "Tài liệu xác minh không hợp lệ, vui lòng kiểm tra lại định dạng/kích thước.",
  AUTHOR_INVALID_TRANSITION: "Không thể chuyển yêu cầu xác minh tác giả sang trạng thái này lúc này.",

  // Phase 3 — Technology Case & Evidence
  CASE_NOT_FOUND: "Không tìm thấy case này.",
  CASE_CREATOR_NOT_VERIFIED_AUTHOR: "Bạn cần là tác giả đã xác minh mới tạo được case.",
  CASE_OWNER_ALREADY_EXISTS: "Case đã có một chủ trì đang hoạt động.",
  CASE_MEMBER_ALREADY_EXISTS: "Người này đã là thành viên của case.",
  CASE_OWNER_NOT_IN_OWNING_ORG: "Chủ trì phải thuộc tổ chức chủ trì của case.",
  CASE_MEMBER_NOT_ACTIVE_IN_ORGANIZATION: "Người được thêm phải là thành viên đang hoạt động của tổ chức đã chọn.",
  CASE_PARTNER_MEMBER_ORG_NOT_LINKED: "Tổ chức của thành viên đối tác chưa được liên kết với case (vai trò PARTNER_COMPANY).",
  CASE_ORGANIZATION_ROLE_NOT_ALLOWED: "Vai trò tổ chức này không hợp lệ.",
  CASE_INVALID_TRANSITION: "Không thể chuyển case sang trạng thái này lúc này.",
  EVIDENCE_NOT_FOUND: "Không tìm thấy bằng chứng này.",
  CASE_EVIDENCE_REQUIRES_CITATION: "Bằng chứng đang hoạt động phải có ít nhất 1 trích dẫn.",
  CASE_EVIDENCE_ROLE_NOT_ALLOWED: "Vai trò của bạn trong case không được phép thêm bằng chứng.",
  RESOURCE_NOT_FOUND: "Không tìm thấy tài nguyên (resource) này.",
  RESOURCE_VERSION_NOT_FOUND: "Không tìm thấy phiên bản tài nguyên (resource version) với UUID này.",
  RESOURCE_VERSION_IMMUTABLE: "Phiên bản tài nguyên này đã xuất bản, không thể sửa.",
  RESOURCE_INVALID_TYPE_FOR_PAPER_METADATA: "Chỉ tài nguyên loại Bài báo mới nhập được các trường DOI/tạp chí/ngày xuất bản.",
  RESOURCE_CONTENT_NOT_FOUND: "Không tìm thấy nội dung tệp của tài nguyên này.",
  RESOURCE_INVALID_TRANSITION: "Không thể chuyển tài nguyên sang trạng thái này lúc này.",
  RESOURCE_ACCESS_DENIED: "Bạn không có quyền đọc phiên bản tài nguyên này.",
  RESOURCE_AUTHOR_NOT_VERIFIED: "Bạn cần được xác minh là tác giả trước khi đăng tài nguyên. Gửi yêu cầu xác minh ở trang Hồ sơ.",
  ANNOTATION_NOT_FOUND: "Không tìm thấy chú giải (annotation) này.",
  ANNOTATION_EMPTY_CONTENT: "Nội dung chú giải không được để trống.",
  ANNOTATION_TARGET_LOCATOR_INVALID: "Vị trí trích dẫn của chú giải không hợp lệ.",
  ACCESS_GRANT_NOT_FOUND: "Không tìm thấy quyền truy cập này.",
  ACCESS_GRANT_DUPLICATE: "Quyền truy cập này đã được cấp trước đó.",
  ACCESS_GRANT_ALREADY_REVOKED: "Quyền truy cập này đã bị thu hồi.",

  // Phase 4 — Assessment
  ASSESSMENT_NOT_FOUND: "Không tìm thấy đợt đánh giá này.",
  ASSESSMENT_HAS_NO_SCORES: "Đánh giá chưa có điểm nào được nhập.",
  ASSESSMENT_SCORE_OUT_OF_RANGE: "Điểm nhập nằm ngoài khoảng cho phép của tiêu chí.",
  ASSESSMENT_CRITERION_NOT_FOUND: "Không tìm thấy tiêu chí đánh giá này.",
  ASSESSMENT_CRITERION_FRAMEWORK_MISMATCH: "Tiêu chí này không thuộc bộ khung đánh giá của đợt đánh giá.",
  ASSESSMENT_SCORE_MISSING_EVIDENCE: "Tiêu chí này bắt buộc phải liên kết ít nhất 1 bằng chứng.",
  ASSESSMENT_SCORE_MISSING_CITATION: "Tiêu chí này bắt buộc phải liên kết ít nhất 1 trích dẫn.",
  ASSESSMENT_INVALID_TRANSITION: "Không thể chuyển đánh giá sang trạng thái này lúc này.",
  ASSESSMENT_FRAMEWORK_NOT_FOUND: "Không tìm thấy bộ khung đánh giá phù hợp (chưa có bộ khung nào đang hoạt động).",

  // Phase 4 — Gap
  GAP_NOT_FOUND: "Không tìm thấy khoảng trống (gap) này.",
  GAP_SEVERITY_REQUIRED: "Vui lòng chọn mức độ nghiêm trọng cho gap.",
  GAP_MISSING_SUPPORT: "Gap cần có ít nhất 1 cơ sở: đánh giá nguồn hoặc bằng chứng liên kết.",
  GAP_RESOLUTION_NOTE_REQUIRED: "Vui lòng nhập ghi chú khi chuyển gap sang trạng thái này.",
  GAP_INVALID_TRANSITION: "Không thể chuyển gap sang trạng thái này lúc này.",

  // Phase 4 — Roadmap
  ROADMAP_NOT_FOUND: "Không tìm thấy lộ trình (roadmap) này.",
  MILESTONE_NOT_FOUND: "Không tìm thấy mốc (milestone) này.",
  MILESTONE_DEPENDENCY_CYCLE_DETECTED: "Không thể thêm phụ thuộc này vì sẽ tạo thành chu trình khép kín.",
  MILESTONE_DEPENDENCIES_MUST_BE_IN_SAME_ROADMAP: "Hai milestone trong 1 phụ thuộc phải cùng thuộc 1 roadmap.",
  ROADMAP_HAS_NO_MILESTONES: "Roadmap chưa có milestone nào — không thể duyệt.",
  ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS: "Còn gap mức độ nghiêm trọng chưa xử lý — không thể duyệt roadmap.",
  ROADMAP_INVALID_TRANSITION: "Không thể chuyển roadmap sang trạng thái này lúc này.",

  // Phase 5 — Company & Discovery
  DISCOVERY_ORG_NOT_ENTERPRISE: "Chỉ tổ chức loại Doanh nghiệp mới có hồ sơ công ty.",
  DISCOVERY_COMPANY_PROFILE_ALREADY_EXISTS: "Tổ chức này đã có hồ sơ công ty.",
  DISCOVERY_COMPANY_PROFILE_NOT_FOUND: "Tổ chức chưa có hồ sơ công ty.",
  DISCOVERY_NEED_NOT_OPEN: "Không tìm thấy nhu cầu nghiên cứu này hoặc bạn không có quyền xem.",
  DISCOVERY_NEED_STATEMENT_INCOMPLETE: "Nội dung nhu cầu chưa đủ cụ thể — hãy mô tả rõ hơn vấn đề cần giải quyết và lĩnh vực kỹ thuật trước khi xuất bản.",
  DISCOVERY_NEED_INVALID_TRANSITION: "Không thể chuyển nhu cầu nghiên cứu sang trạng thái này lúc này.",
  DISCOVERY_AUTHOR_NOT_VERIFIED: "Bạn cần được xác minh là tác giả trước khi gửi đề xuất. Gửi yêu cầu xác minh ở trang Hồ sơ.",
  DISCOVERY_PROPOSAL_STATE_INVALID: "Không thể thực hiện thao tác này với đề xuất ở trạng thái hiện tại.",
  DISCOVERY_RUN_ALREADY_IN_PROGRESS: "Đã có một lượt gợi ý đang được xử lý cho nhu cầu này, vui lòng đợi.",
  DISCOVERY_RECOMMENDATION_ITEM_NOT_ACTIVE: "Gợi ý này vừa được cập nhật, vui lòng tải lại trang.",
  DISCOVERY_INITIATION_REQUEST_NOT_PENDING: "Yêu cầu này không còn ở trạng thái chờ phản hồi.",
  DISCOVERY_INITIATION_REQUEST_EXPIRED: "Yêu cầu này đã hết hạn.",

  // Cộng đồng đợt 6 — endorse kỹ năng
  PUBLIC_PROFILE_ENDORSEMENT_INVALID_TAG: "Kỹ năng này hiện không nằm trong danh sách kỹ năng của tác giả.",
};

const FALLBACK_MESSAGE_VI = "Đã có lỗi xảy ra, vui lòng thử lại.";

export function describeErrorCode(code: string): string {
  return ERROR_MESSAGES_VI[code] ?? FALLBACK_MESSAGE_VI;
}
