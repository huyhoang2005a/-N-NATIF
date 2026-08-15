# R2M (Research-to-Market) V5 — Tài liệu tổng quan dự án

*Cập nhật: 13/08/2026. Tài liệu tổng hợp từ lịch sử phát triển — các số liệu/route là ảnh chụp tại thời điểm ghi nhận, nên đối chiếu lại code/API thật trước khi trích dẫn trong báo cáo chính thức.*

## 1. Tên & mục tiêu dự án

**R2M — Research-to-Market V5**: nền tảng công nghệ kết nối **tổ chức nghiên cứu**, **doanh nghiệp** và **cơ quan nhà nước** để thúc đẩy **chuyển giao công nghệ** (technology transfer). Nền tảng số hoá toàn bộ chu trình:

đăng ký & xác minh danh tính tổ chức/tác giả → công bố tài nguyên nghiên cứu → theo dõi case công nghệ kèm bằng chứng → đánh giá độ sẵn sàng & phân tích khoảng cách → lập lộ trình → thực hiện chuyển giao có kiểm soát quyền truy cập.

Thư mục làm việc gốc: `D:\ĐỀ ÁN NATIF\r2m_v5_complete_spec\platform`.

## 2. Kiến trúc kỹ thuật

**Monorepo**: `pnpm` + `Turborepo`.

| Package | Vai trò |
|---|---|
| `apps/web` | Next.js App Router — toàn bộ UI |
| `apps/api` | NestJS modular monolith, **10 bounded context** |
| `apps/worker` | BullMQ — dispatcher outbox: gửi email, thông báo, chấm điểm gợi ý, quét hết hạn |
| `packages/domain` | Domain models, port interfaces |
| `packages/authz` | Phân quyền |
| `packages/env` | Zod schema cho biến môi trường |
| `packages/database` | Drizzle ORM schema/migration |
| `packages/contracts` | Kiểu dữ liệu request/response dùng chung FE-BE |
| `packages/testkit` | Tiện ích test |
| `packages/file-safety` | MIME-sniff + quét mã độc (ClamAV) cho file upload |

**Hạ tầng**: Postgres 16 + Drizzle ORM, Redis (BullMQ), MinIO (S3-compatible, local) — chạy qua `docker compose` (container `r2m-v5-local-{postgres,redis,minio}-1`).

**10 bounded context của `apps/api`**: identity-organization, author-resource, technology-case-evidence, assessment-gap-roadmap, company-discovery, roadmap-transfer, platform-operations, community, assistant (AI chatbot), + module hạ tầng dùng chung.

## 3. Tiến trình dự án — theo 8 phase (CLAUDE.md)

| Phase | Nội dung | Trạng thái | Hoàn thành |
|---|---|---|---|
| 0 | Spec lock | ✅ Xong | — |
| 1 | Platform foundation (Identity/Org/Verification) | ✅ Xong | — |
| 2 | Author & Resource | ✅ Xong | — |
| 3 | Technology Case & Evidence | ✅ Xong | — |
| 4 | Assessment / Gap / Roadmap | ✅ Xong | — |
| 5 | Company & Discovery (7 sprint: 5.1–5.7) | ✅ Xong | 08/08/2026 |
| 6 | Transfer & Moderation (4 sprint: 6.1–6.4) | ✅ Xong | 10/08/2026 |
| 7 | Production hardening | ⏳ **Chưa bắt đầu** | — |

### Chi tiết Phase 5 — Company & Discovery
- **5.1 Company Profile** — CRUD hồ sơ doanh nghiệp (ENTERPRISE org), auto-slug có xử lý trùng.
- **5.2 Research Need** — vòng đời DRAFT→OPEN→PAUSED→CLOSED (bổ sung endpoint `resume` để khép kín state diagram spec đã vẽ), phát biểu nhu cầu có version, cổng kiểm tra "đủ cụ thể" trước khi publish.
- **5.3 Research Proposal** — submit/review/accept/reject/withdraw; accept tạo Technology Case (đã refactor `TechnologyCaseService.register()` thành `createCaseCore()` dùng chung cho 3 luồng tạo case khác nhau — tránh trùng logic).
- **5.4 AI Recommendation (FOCUSED)** — chỉ dùng Postgres full-text search (`ts_rank_cd`), **chưa dùng LLM/embedding** (cột `resource_chunk.embedding` để dành cho Phase 5b tương lai). Worker tính điểm đồng bộ ngay trong vòng lặp outbox-dispatcher sẵn có, không thêm hạ tầng queue mới.
- **5.5 Feed** — cùng cơ chế chấm điểm, truy vấn theo `company_profile.industryCode + description`, dismiss-exclusion lưu lịch sử qua các lần chạy.
- **5.6 Case Initiation** — request/accept/decline; accept tái sử dụng citation sẵn có của gợi ý làm bằng chứng (không tạo trùng); sweep hết hạn 5 phút gắn vào vòng lặp chính của worker.
- **5.7 Card summary + hồ sơ công khai** — `GET /authors/:slug/public-profile`, `GET /organizations/:slug/public-profile`, đều `@Public()`, luôn trả 404 khi không có/chưa xác minh/không hoạt động (không bao giờ 403).

**2 bug thật phát hiện qua live-test (không bị bắt bởi typecheck)**: (1) `plainto_tsquery` AND toàn bộ từ khoá — khi truyền cả đoạn mô tả nhu cầu dài khớp gần như không ra kết quả, đã sửa bằng cách build `to_tsquery` dạng OR; (2) `ts_headline`'s `StartSel=/StopSel=` không thể set rỗng thật qua chuỗi option — xử lý bằng cách strip markup `<b>` ở phía JS sau truy vấn.

### Chi tiết Phase 6 — Transfer & Moderation
- **6.1 Transfer Manifest** — CRUD (tạo DRAFT, thêm hạng mục từ bằng chứng case, thêm người nhận), chỉ Case Owner được thao tác (kiểm tra vai trò đơn, chặt hơn pattern WRITE_ROLES thông thường).
- **6.2 Share & Revoke** — state machine DRAFT→READY→SHARED→EXPIRED/REVOKED; `share()` kiểm tra ≥1 hạng mục + ≥1 người nhận + hạn dùng trong tương lai, tạo N dòng `resource_access_grant` trong cùng transaction; worker tự động hết hạn manifest + grant quá `expires_at`.
- **6.3 Content Moderation** — `content_flag` (áp dụng cho resource/annotation/technology_profile) → hàng đợi reviewer → claim (optimistic lock qua status, không dùng version column) → quyết định (KEEP/HIDE/REMOVE/RESTRICT_AUTHOR/RESTORE). Đã xử lý 1 xung đột spec: dbml không có giá trị `DISMISS` trong enum `ModerationAction` dù mô tả use case có nhắc — giải quyết bằng `action=KEEP` + cột riêng `content_flag.status=DISMISSED`.
- **6.4 Notification** — `GET /notifications` (limit 50, lọc theo status), đánh dấu đã đọc/dismiss hàng loạt theo id[], luôn giới hạn theo actor hiện tại (id không thuộc về mình sẽ no-op, không báo lỗi).

### Tính năng ngoài spec (được người dùng duyệt bổ sung riêng, không nằm trong `docs/spec/`)
| Tính năng | Hoàn thành | Ghi chú |
|---|---|---|
| Redesign đăng ký tổ chức + tự tham gia tổ chức có sẵn | 07/08/2026 | Tài liệu xác minh bắt buộc gộp vào 1 lần đăng ký (multipart); join-request cần chủ sở hữu duyệt (`PENDING_APPROVAL`) |
| Vá xác minh email + gửi email thật | 07/08/2026 | Ban đầu qua Resend, sau đó chuyển kênh chính sang SMTP |
| Cộng đồng (Community) — 7 đợt, phong cách Reddit/LinkedIn | 10/08/2026 | Bounded context thứ 9 |
| Avatar upload + chuyển email sang SMTP | 12/08/2026 | SMTP (Gmail) thay Resend làm kênh chính |
| Đổi mật khẩu, tra cứu tên người dùng, danh sách org/user toàn nền tảng (admin) | 12/08/2026 | Đóng 4/5 gap phát hiện qua audit persona/route |
| Trợ lý AI chatbot v1 (Gemini) | 13/08/2026 | Bounded context thứ 10 |

## 4. Độ hoàn thiện

### Frontend (`apps/web`) — snapshot 12/08/2026
- 33 route đã build; sau đợt vá cuối, **toàn bộ đều dùng dữ liệu thật, không mock** (2 route admin `/platform/organizations`, `/platform/users` từng là màn hình "Sắp ra mắt" (`SoonPage`) nay đã có backend `GET /platform/organizations`/`GET /platform/users` thật, có phân trang).
- 1 hệ thống thiết kế thống nhất: class `uikit-*` trong `globals.css`, accent **indigo-700**, hệ trạng thái **5 tông màu** (gray/blue/green/amber/red), icon `lucide-react`.
- 0 route còn dùng thiết kế cũ.
- Đã hoàn thành đợt responsive toàn app: sidebar chuyển thành drawer di động (<900px), tab cuộn ngang (case detail có 6 tab), bảng cuộn ngang, lưới stat-tile co giãn 4→2→1 / 3→2→1.
- Dashboard: đã dọn sạch toàn bộ ô số liệu "Sắp ra mắt" còn sót (6 ô, phát hiện qua rà soát riêng vì dùng component khác `SoonPage`).

### Backend (`apps/api`)
- Phase 1–4: ~94% endpoint coverage (67/71 theo tài liệu cũ, số liệu tương đối chính xác cho phần này).
- Phase 5/6/Community/Assistant: đầy đủ theo scope đã chốt, đã live-test bằng curl trên môi trường dev thật, chưa tính % coverage riêng.

### Kiểm thử
- Chủ yếu là **curl trực tiếp** vào API thật + `typecheck`/`build` sạch trên mọi đợt giao (đúng theo kỷ luật đã thiết lập cho dự án: build/test rồi mới coi là xong).
- **Chưa có click-through UI qua trình duyệt thật** ở bất kỳ tính năng nào (không có công cụ browser automation trong môi trường làm việc hiện tại) — đây là khoảng trống kiểm thử lớn nhất, rủi ro bug UI thực tế cao nhất nằm ở phần Cộng đồng (chưa từng được thao tác qua UI thật một lần nào).

## 5. Danh sách tính năng đầy đủ

**Nền tảng & danh tính**
- Đăng ký tổ chức kèm tài liệu xác minh bắt buộc (TAX_DOCUMENT hoặc ORGANIZATION_LETTER) trong 1 lần gọi multipart (org + owner + tài liệu tạo cùng 1 transaction)
- Xác thực email thật (token dạng hash, cooldown gửi lại 60 giây)
- Tự tham gia tổ chức có sẵn, chờ chủ sở hữu/admin duyệt
- Xác minh tác giả, xác minh tổ chức (reviewer duyệt/từ chối, gate chặn approve khi 0 tài liệu đính kèm)
- Đổi mật khẩu, quản lý hồ sơ cá nhân, upload ảnh đại diện (chỉ JPEG/PNG)
- Tra cứu tên người dùng khác theo lô (không lộ email/số điện thoại)

**Tài nguyên & Case công nghệ**
- Quản lý tài nguyên nghiên cứu (Resource), phiên bản (version), ghi chú (annotation)
- Case công nghệ kèm bằng chứng (Evidence), nhiều thành viên/vai trò trong case
- Đánh giá độ sẵn sàng (Assessment), phân tích khoảng cách (Gap), lộ trình chuyển giao (Roadmap)

**Company & Discovery**
- Hồ sơ doanh nghiệp (Company Profile)
- Nhu cầu nghiên cứu (Research Need) với vòng đời trạng thái đầy đủ
- Đề xuất (Research Proposal): nộp / duyệt / từ chối / rút
- Gợi ý công nghệ bằng full-text search (chưa dùng AI/embedding — đã có kế hoạch nâng cấp nhưng chưa triển khai)
- Feed cá nhân hoá theo ngành nghề tổ chức
- Khởi tạo case công nghệ trực tiếp từ đề xuất/gợi ý được chấp nhận
- Hồ sơ công khai tác giả/tổ chức (xem được không cần đăng nhập)

**Chuyển giao & Kiểm duyệt**
- Transfer Manifest: tạo, thêm hạng mục từ bằng chứng case, thêm người nhận
- Chia sẻ có thời hạn + thu hồi quyền truy cập (access grant), tự động hết hạn
- Gắn cờ nội dung (resource/annotation/technology_profile), hàng đợi kiểm duyệt, quyết định (giữ/ẩn/gỡ/hạn chế tác giả/khôi phục)
- Trung tâm thông báo: đọc/dismiss hàng loạt, badge số chưa đọc trên chuông thông báo

**Cộng đồng (phong cách Reddit/LinkedIn)**
- Upvote resource & research-need (chủ động chọn **không có downvote**), sắp xếp mới/nổi bật/hot
- Lưu/bookmark
- Theo dõi tác giả/tổ chức, activity feed tính trực tiếp từ danh sách theo dõi (không có bảng riêng)
- Uy tín tác giả: tổng lượt upvote nhận được + số đề xuất được chấp nhận — 2 con số minh bạch, **chủ động không gộp** thành điểm "karma"
- Endorsement kỹ năng chuyên môn (expertise tag)
- Khám phá (`/explore`) nhu cầu nghiên cứu theo lĩnh vực kỹ thuật

**AI**
- Trợ lý chatbot (Gemini, model `gemini-flash-latest`) hỏi đáp cơ chế nền tảng — phiên bản v1: **không truy cập dữ liệu tài khoản/case**, chỉ trả lời theo system prompt cố định mô tả cách R2M vận hành; yêu cầu đăng nhập chỉ để giới hạn lạm dụng (rate-limit 20 request/60 giây/người dùng); widget chat nổi trên mọi trang đã đăng nhập

**Quản trị nền tảng**
- Danh sách toàn nền tảng: tổ chức, người dùng (có phân trang)
- Hàng đợi xác minh tổ chức/tác giả
- Hàng đợi kiểm duyệt nội dung bị gắn cờ
- Dashboard thống kê theo vai trò (tác giả / doanh nghiệp / quản trị) — **không có bộ chuyển vai trò thủ công**, vai trò hiển thị suy ra hoàn toàn từ dữ liệu thật (`platformRole` + loại tổ chức + case membership)

## 6. Còn thiếu / hạn chế biết trước

- **Phase 7 — Production hardening**: chưa triển khai. Đây là phần còn lại lớn nhất trong lộ trình 8 phase.
- **Đăng nhập SSO**: chưa làm, cần nhà cung cấp OAuth ngoài — người dùng đã chủ động chọn hoãn khi được hỏi.
- **Chatbot AI v2** (trả lời theo dữ liệu tài khoản thật qua tool-calling): chưa làm — cần đi qua đúng cơ chế phân quyền như UI, và phải chống prompt injection từ nội dung do người dùng khác nhập (tiêu đề case, nội dung bằng chứng...) trước khi triển khai.
- **Nâng cấp gợi ý AI bằng embedding** (cột `resource_chunk.embedding`, pgvector 1536 chiều): đã có kế hoạch phân giai đoạn (P0–P3: embedding → hybrid search → LLM re-rank → feed cá nhân hoá) nhưng **chưa triển khai bước nào**, hiện vẫn dùng full-text search thuần.
- Trang chi tiết case còn thiếu nút tạo gap/roadmap trực tiếp.
- Chưa có sửa vai trò/trạng thái thành viên tổ chức ngay trên UI (đã có mời + duyệt/từ chối yêu cầu tham gia, nhưng chưa sửa trực tiếp).
- Chưa kiểm thử click-through UI qua trình duyệt thật ở bất kỳ tính năng nào — chỉ typecheck/build/curl.
- Tài khoản demo phong phú trước đây (`demo-tacgia@r2m.local`, `demo-doanhnghiep@enterprise-demo.local`, `demo-kiemdinh@r2m.local`) **đã mất** (nhiều khả năng do reset volume Postgres), chỉ còn 3 tài khoản seed gốc còn sống: `admin@r2m.local`, `reviewer@r2m.local`, `owner@sample-research-unit.local` (mật khẩu `ChangeMe123!`).
- Email: đã chuyển kênh chính sang SMTP (Gmail) nhưng người dùng **chưa cung cấp** địa chỉ Gmail/App Password thật — hệ thống hiện fallback về Resend sandbox (`onboarding@resend.dev`), chưa gửi được email thật đến người nhận bất kỳ.
- Bug thiết kế cũ, phát hiện nhưng chưa fix (ngoài phạm vi các đợt vừa qua): `apps/worker`'s cơ chế `notify()` + gửi email trong cùng 1 nhánh xử lý outbox **không idempotent** khi retry — nếu bước gửi email lỗi, việc retry chạy lại `notify()` có thể đụng ràng buộc unique và che mất lỗi gốc, đốt hết 5 lần thử vào `DEAD_LETTER`. Chưa xảy ra với người nhận thật, mới thấy trong môi trường sandbox bị giới hạn gửi.

## 7. Tài liệu tham khảo (đường dẫn tương đối tới `platform/`)

- `CLAUDE.md` — quy tắc bắt buộc, đọc trước mọi task; mục "Quy tắc UI/Frontend" ở cuối file.
- `docs/spec/` — spec sản phẩm gốc (use case, schema `.dbml`, ràng buộc, breakdown theo phase). Nguồn chân lý cho nghiệp vụ backend.
- `docs/openapi/v1/v1.yaml` — hợp đồng API thật.
- `docs/FRONTEND_UI_STATUS.md` — tài liệu trạng thái UI (lưu ý: viết ngày 07/08/2026, đã lỗi thời so với thực tế 13/08/2026 — ưu tiên tài liệu này hoặc code thật).
- `apps/web/app/docs/design/{01-author,02-company,03-verifier,04-admin,05-auth}.jsx` — mockup định hướng UI (dữ liệu giả, chỉ tham khảo hướng thiết kế, không phải code để copy).

## 8. Quy ước quan trọng khi phát triển tiếp

- **Không hardcode dữ liệu mẫu** trong code production, kể cả cho phase chưa có backend — dùng màn hình "Sắp ra mắt" (icon + tiêu đề + 1 câu giải thích), không bao giờ list/form với dữ liệu "preview".
- **Không có bộ chuyển vai trò (role-switcher)** — vai trò hiển thị luôn suy ra từ dữ liệu thật.
- Design token khoá cứng: accent indigo-700, hệ 5 tông trạng thái, icon `lucide-react` — không tự ý đổi.
- Component dùng ở từ 2 trang trở lên phải đưa vào thư viện dùng chung, không copy-paste.
- Giao tiếp và nội dung sản phẩm bằng tiếng Việt.
