/** Server error codes are stable (CLAUDE.md "Error code ổn định"); the raw `message` text
 * from the API is English and meant for logs, not end users — map codes to Vietnamese copy
 * here instead of surfacing `error.message` directly in the UI. */
const ERROR_MESSAGES_VI: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  AUTH_ACCOUNT_SUSPENDED: "Tài khoản đã bị tạm khoá.",
  AUTH_UNAUTHENTICATED: "Vui lòng đăng nhập để tiếp tục.",
  AUTH_EMAIL_ALREADY_REGISTERED: "Email này đã được đăng ký cho một tài khoản khác.",
  ORG_ALREADY_EXISTS: "Tên tổ chức hoặc domain email này đã được đăng ký cho một tổ chức khác.",
};

const FALLBACK_MESSAGE_VI = "Đã có lỗi xảy ra, vui lòng thử lại.";

export function describeErrorCode(code: string): string {
  return ERROR_MESSAGES_VI[code] ?? FALLBACK_MESSAGE_VI;
}
