import { loadEnv } from "@r2m/env";

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function verifyEmailTemplate(token: string, expiresAt: string): EmailTemplate {
  const env = loadEnv();
  const link = `${env.WEB_APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    subject: "Xác thực địa chỉ email của bạn trên R2M",
    html: `<p>Chào bạn,</p>
<p>Vui lòng xác thực địa chỉ email của bạn bằng cách nhấn vào liên kết dưới đây:</p>
<p><a href="${link}">${link}</a></p>
<p>Liên kết có hiệu lực đến ${new Date(expiresAt).toLocaleString("vi-VN")}. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>`,
  };
}

export function organizationApprovedTemplate(): EmailTemplate {
  const env = loadEnv();
  return {
    subject: "Chào mừng đến với R2M — tổ chức của bạn đã được xác minh!",
    html: `<p>Chào bạn,</p>
<p>Tin vui: tổ chức của bạn vừa được kiểm định viên xác minh và hiện đã <strong>hoạt động</strong>
trên R2M. Chào mừng bạn chính thức gia nhập cộng đồng chuyển giao công nghệ R2M!</p>
<p>Giờ đây tổ chức của bạn có thể đăng tài nguyên nghiên cứu, tạo technology case và mời thêm
thành viên. Đăng nhập để bắt đầu:</p>
<p><a href="${env.WEB_APP_URL}/login">${env.WEB_APP_URL}/login</a></p>
<p>Cảm ơn bạn đã đồng hành cùng R2M.</p>`,
  };
}

export function organizationRejectedTemplate(reason: string): EmailTemplate {
  return {
    subject: "Yêu cầu xác minh tổ chức bị từ chối",
    html: `<p>Chào bạn,</p><p>Yêu cầu xác minh tổ chức của bạn đã bị từ chối.</p><p>Lý do: ${reason}</p>`,
  };
}

export function authorApprovedTemplate(): EmailTemplate {
  return {
    subject: "Bạn đã trở thành tác giả được xác minh trên R2M",
    html: `<p>Chào bạn,</p><p>Yêu cầu xác minh tác giả của bạn đã được duyệt.</p>`,
  };
}

export function authorRejectedTemplate(reason: string): EmailTemplate {
  return {
    subject: "Yêu cầu xác minh tác giả bị từ chối",
    html: `<p>Chào bạn,</p><p>Yêu cầu xác minh tác giả của bạn đã bị từ chối.</p><p>Lý do: ${reason}</p>`,
  };
}
