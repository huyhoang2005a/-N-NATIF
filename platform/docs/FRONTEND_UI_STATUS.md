# Tình trạng giao diện apps/web — cập nhật 2026-08-07

Tài liệu này chốt lại: **luồng nào đã dựng giao diện thật (nối API thật)**,
**luồng nào mới có khung "Sắp ra mắt"**, và **luồng nào chưa động tới**, đối
chiếu với 5 file tham chiếu thiết kế ở `apps/web/app/docs/design/*.jsx` và với
danh sách endpoint thật trong `docs/openapi/v1/v1.yaml`.

Cách tính "% tương thích": số endpoint **đã có backend thật** (Phase 1–4) mà
**đã có UI thao tác** / tổng số endpoint đã có backend thật. Phase 5–7 không
tính vào % này vì chưa có backend — được báo riêng ở mục 4.

---

## 1. Tóm tắt nhanh

| Hạng mục | Kết quả |
|---|---|
| **Route đã dựng, nối API thật** | 20 route |
| **Route "Sắp ra mắt"** (khung đẹp, chưa có backend) | 7 route |
| **Route chưa động tới** | 0 (toàn bộ app đã đồng nhất 1 hệ thiết kế) |
| **% endpoint Phase 1–4 (đã có backend) có UI thao tác** | **≈ 94%** (67/71 endpoint) |
| **Hệ thiết kế** | Đồng nhất 100% — 1 hệ `uikit-*` (indigo-700, 5-tone, icon lucide-react) cho toàn bộ app đã đăng nhập |

---

## 2. Bảng route đầy đủ

| Route | Persona thấy | Trạng thái | Nguồn dữ liệu |
|---|---|---|---|
| `/` | Khách (chưa đăng nhập) | ✅ Thật | tĩnh, redirect `/dashboard` nếu đã đăng nhập |
| `/login` | Khách | ✅ Thật | `POST /auth/login` |
| `/register-organization` | Khách | ✅ Thật | `POST /organizations/register` |
| `/dashboard` | Cả 3 persona (rẽ nhánh tự động) | ✅ Thật | `/me`, `/organizations`, `/technology-cases`, `/resources`, hàng chờ duyệt (platform-ops) |
| `/resources` | Tác giả, Doanh nghiệp | ✅ Thật | `GET /resources` (+ `?q=` tìm kiếm) |
| `/resources/new` | Tác giả, Doanh nghiệp | ✅ Thật | `POST /resources/uploads` + `POST /resources` |
| `/resources/[id]` | Tác giả, Doanh nghiệp | ✅ Thật (1 phần) | xem mục 4 — thiếu list phiên bản/chú giải |
| `/technology-cases` | Tác giả, Doanh nghiệp | ✅ Thật | `GET /technology-cases` |
| `/technology-cases/new` | Tác giả | ✅ Thật | `POST /technology-cases` |
| `/technology-cases/[id]` | Cả 3 persona | ✅ Thật (1 phần) | 5 tab + "Quản trị case" — xem mục 4 (thiếu tạo gap/roadmap) |
| `/assessments/[id]` | Tác giả, Kiểm định viên | ✅ Thật | nhập điểm, nộp, duyệt/từ chối |
| `/gaps/[id]` | Tác giả, Kiểm định viên | ✅ Thật | sửa, chuyển trạng thái |
| `/roadmaps/[id]` | Tác giả, Kiểm định viên | ✅ Thật | milestone, task, dependency, review |
| `/profile` | Cả 3 persona | ✅ Thật | sửa hồ sơ, tổ chức + mời thành viên, xác minh tác giả |
| `/platform/organization-verifications` | Kiểm định viên, Admin | ✅ Thật | claim/duyệt/từ chối tổ chức |
| `/platform/author-verifications` | Kiểm định viên, Admin | ✅ Thật | claim/duyệt/từ chối tác giả |
| `/platform/reviews` | Kiểm định viên, Admin | ✅ Thật | tổng hợp assessment/roadmap chờ duyệt từ case thật |
| `/needs` | Doanh nghiệp | 🟡 Sắp ra mắt | Phase 5 — chưa có backend |
| `/recommendations` | Doanh nghiệp | 🟡 Sắp ra mắt | Phase 5 — chưa có backend |
| `/proposals` | Tác giả | 🟡 Sắp ra mắt | Phase 5 — chưa có backend |
| `/proposals-received` | Doanh nghiệp | 🟡 Sắp ra mắt | Phase 5 — chưa có backend |
| `/notifications` | Cả 3 persona | 🟡 Sắp ra mắt | chưa có backend thông báo |
| `/platform/flags` | Kiểm định viên, Admin | 🟡 Sắp ra mắt | Phase 6 (kiểm duyệt) — chưa có backend |
| `/platform/organizations` | Admin | 🟡 Sắp ra mắt | có `GET /organizations` nhưng chỉ trả tổ chức actor là thành viên, không phải toàn nền tảng |
| `/platform/users` | Admin | 🟡 Sắp ra mắt | chưa có endpoint liệt kê người dùng |

**27 route tổng cộng** (25 route Next.js build ra + `/` và `/login` không đếm
trùng) — 20 thật, 7 sắp ra mắt, 0 còn dùng giao diện cũ.

---

## 3. Đối chiếu với từng file tham chiếu thiết kế

### `05-auth.jsx` (Đăng nhập/Đăng ký) — **100%**
Toàn bộ luồng đăng nhập + đăng ký tổ chức 2 bước đã nối API thật, test qua
Playwright end-to-end (kể cả tạo tổ chức thật và nhận banner "Chờ kiểm định
viên duyệt"). Bỏ có chủ đích: SSO login, "remember me" — không có backend.

### `01-author.jsx` (Tác giả) — **≈ 95%**
Tổng quan, Tài nguyên (list/mới/chi tiết), Case của tôi (list/5 tab), Hồ sơ:
đều thật. Đề xuất/Thông báo: sắp ra mắt (đúng, Phase 5 chưa có API).

Thiếu (đã có API Phase 4, chưa có nút bấm): tab **Gap** trong case detail chỉ
xem danh sách, không có nút "Ghi nhận gap mới"; tab **Lộ trình** chỉ xem
roadmap mới nhất, không có nút "Tạo roadmap mới". Cả 2 endpoint
(`POST .../gaps`, `POST .../roadmaps`) đều hoạt động thật, chỉ là chưa có
form gọi tới — do bám sát đúng 5 tab của file tham chiếu (bản demo không có
2 nút này).

### `02-company.jsx` (Doanh nghiệp) — **≈ 40%**
Tổng quan (một phần) + Case của tôi: thật, dùng lại đúng route
`/technology-cases`. Nhu cầu nghiên cứu, Gợi ý công nghệ, Đề xuất nhận được:
sắp ra mắt — đúng thực trạng, Phase 5 (Company & Discovery) chưa triển khai
backend. % thấp vì 3/5 mục nav của persona này là tính năng chưa có API,
không phải do UI dựng thiếu.

### `03-verifier.jsx` (Kiểm định viên) — **≈ 90%**
Tổng quan, Xác minh tổ chức, Xác minh tác giả, Duyệt đánh giá & lộ trình:
thật, có claim/duyệt/từ chối đầy đủ. Kiểm duyệt nội dung: sắp ra mắt (Phase 6,
chưa có endpoint gắn cờ/xử lý nội dung nào trong toàn bộ OpenAPI spec).

### `04-admin.jsx` (Admin) — **≈ 60%**
Dùng chung Tổng quan + Xác minh tổ chức + Kiểm duyệt với kiểm định viên
(backend cấp quyền y hệt nhau — `isPlatformReviewerOrAdmin`). Tổ chức và
Người dùng: sắp ra mắt vĩnh viễn cho tới khi có endpoint "liệt kê toàn bộ tổ
chức/người dùng trên nền tảng" — hiện `GET /organizations` chỉ trả tổ chức
actor là thành viên, không có `GET /users` nào cả.

---

## 4. Giới hạn thật đã biết (API có nhưng UI chưa/không thể phủ hết)

| # | Chỗ thiếu | Vì sao |
|---|---|---|
| 1 | Case detail — tab Gap không có nút tạo gap mới | Bám đúng 5 tab file tham chiếu 01-author.jsx (bản demo không có nút này); `POST /technology-cases/{id}/gaps` (Phase 4) đã hoạt động, có thể thêm form giống mẫu "Thêm bằng chứng" bất kỳ lúc nào |
| 2 | Case detail — tab Lộ trình không có nút tạo roadmap mới | Tương tự #1, `POST /technology-cases/{id}/roadmaps` (Phase 4) đã hoạt động |
| 3 | `/resources/[id]` — mục Phiên bản chỉ hiện bản vừa tạo trong phiên làm việc | Không có `GET` liệt kê version của 1 resource trong OpenAPI — chỉ có `POST` tạo |
| 4 | `/resources/[id]` — mục Chú giải chỉ hiện chú giải vừa tạo, và chưa có nút "Sửa" | Không có `GET` liệt kê annotation theo version; `POST /annotations/{id}/revisions` (sửa) có backend nhưng chưa nối UI |
| 5 | Quản lý thành viên tổ chức — không sửa được vai trò/trạng thái thành viên đã có | `PATCH /organizations/{id}/members/{memberId}` cần biết trước `memberId`, nhưng không có `GET` liệt kê thành viên tổ chức nào trong spec |
| 6 | `/platform/organizations`, `/platform/users` | Không có endpoint "liệt kê toàn bộ" — chỉ liệt kê theo phạm vi actor |
| 7 | Tên người dùng khác hiển thị dạng UUID rút gọn (case member, author-verification applicant...) | Không có endpoint tra cứu hồ sơ người dùng khác ngoài `/me` |
| 8 | Kiểm duyệt nội dung (`/platform/flags`) | Không tồn tại endpoint nào liên quan (gắn cờ/ẩn/xoá nội dung) trong toàn bộ OpenAPI spec |
| 9 | Đổi mật khẩu | Không có endpoint |
| 10 | SSO / "Ghi nhớ đăng nhập" | Không có backend, cũng không dựng UI trang trí |

---

## 5. % tương thích theo bounded context (Phase 1–4, đã có backend)

| Bounded context | Endpoint có UI / tổng endpoint thật | % |
|---|---|---|
| Identity & Organization, Verification (Phase 1) | 20/21 | 95% |
| Resource Catalog & Evidence (Phase 2) | 11/12 | 92% |
| Technology Case & Evidence (Phase 3) | 10/10 | 100% |
| Assessment, Gap, Roadmap (Phase 4) | 26/28 | 93% |
| **Tổng Phase 1–4** | **67/71** | **≈ 94%** |
| Company & Discovery (Phase 5) | 0/0 (chưa có endpoint nào) | N/A — UI đã dựng khung sẵn |
| Transfer & Moderation (Phase 6) | 0/0 (chưa có endpoint nào) | N/A — UI đã dựng khung sẵn |

---

## 6. Việc tiếp theo hợp lý nhất (nếu cần)

1. Thêm 2 form nhỏ đang thiếu ở mục 4.1–4.2 (tạo gap / tạo roadmap ngay từ
   case detail) — không cần chờ backend, endpoint đã sẵn.
2. Khi Phase 5 (Company & Discovery) có backend: 5 route sắp-ra-mắt
   (`needs`, `recommendations`, `proposals`, `proposals-received`,
   `notifications`) chỉ cần thay `SoonPage` bằng UI thật — layout/nav/icon
   đã sẵn, không phải dựng lại từ đầu.
3. Khi có endpoint liệt kê thành viên tổ chức / liệt kê tổ chức-người dùng
   toàn nền tảng: mở khoá được mục 4.5 và 4.6.
