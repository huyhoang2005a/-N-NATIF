# Runbook — Xoay vòng Secret (Secret Rotation)

Danh sách dưới đây là **đúng các secret thật đang tồn tại** trong `.env` và
`infra/docker/docker-compose.yml` của repo này tại thời điểm viết (Phase 7 Sprint 7.5) — không
thêm secret nào không có thật. Với môi trường dev local hiện tại, các giá trị này chỉ là quy
ước chỗ để trống (`r2m`, `r2m-secret`, `change-me-*`...); quy trình dưới đây mô tả **cách xoay
đúng** khi các giá trị đó là secret thật của một môi trường staging/production sau này.

**Nguyên tắc chung, áp dụng cho mọi secret bên dưới:**
1. Không bao giờ commit giá trị secret thật vào git (`.env` đã có trong `.gitignore` — xác
   nhận lại điều này trước khi xoay bất kỳ secret nào, đừng giả định).
2. Xoay secret nào, restart đúng (các) process/container phụ thuộc secret đó — không restart
   toàn bộ stack nếu không cần, để giảm thời gian gián đoạn.
3. Sau khi xoay, xác nhận bằng 1 request/thao tác thật (không chỉ nhìn thấy process khởi động
   không lỗi) — ví dụ login lại, upload thử, chạy `pnpm migrate` thử — trước khi coi là xong.
4. Ghi lại ngày xoay + lý do (định kỳ theo lịch, hay do nghi ngờ rò rỉ) — không có bảng/log tự
   động nào cho việc này trong hệ thống hiện tại; ghi thủ công vào changelog vận hành nội bộ.

## 1. `DATABASE_URL` — mật khẩu role `r2m` (superuser/owner, chỉ dùng cho migrate/seed)

**Nơi cấu hình:** `docker-compose.yml`'s `POSTGRES_PASSWORD` (khởi tạo container lần đầu) +
`.env`'s `DATABASE_URL`. Đổi `POSTGRES_PASSWORD` trong compose **không** tự đổi mật khẩu của
role đã tồn tại trong volume dữ liệu đang chạy (biến này chỉ có tác dụng lúc khởi tạo DB lần
đầu) — với 1 Postgres đã có dữ liệu, phải đổi qua SQL trực tiếp.

**Cách xoay:**
```sql
-- chạy bằng chính role r2m hiện tại (hoặc superuser khác nếu có)
ALTER ROLE r2m WITH PASSWORD 'mật-khẩu-mới';
```
Cập nhật `DATABASE_URL` trong `.env` (và bất kỳ nơi nào khác dùng connection string này —
hiện tại chỉ `packages/database/src/client.ts`'s `getDb()`, dùng bởi script `migrate`/`seed`,
**không** dùng bởi `apps/api`/`apps/worker` lúc chạy — từ Phase 7 Sprint 7.1, 2 app đó đã
chuyển sang `APP_DATABASE_URL`/role `r2m_app`, xem mục 2 bên dưới).

**Ảnh hưởng khi xoay:** không downtime cho `apps/api`/`apps/worker` (không dùng role này lúc
chạy) — chỉ ai đang chạy `pnpm migrate`/`pnpm seed`/kết nối `psql` trực tiếp bằng role này cần
cập nhật lại.

## 2. `APP_DATABASE_URL` — mật khẩu role `r2m_app` (runtime, non-superuser)

**Nơi cấu hình:** tạo bởi `packages/database/manual-migrations/0012_phase7_app_role_grants.sql`
(chạy 1 lần), mật khẩu nằm trong `.env`'s `APP_DATABASE_URL`.

**Cách xoay:**
```sql
ALTER ROLE r2m_app WITH PASSWORD 'mật-khẩu-mới';
```
Cập nhật `APP_DATABASE_URL` trong `.env`, sau đó **bắt buộc restart cả `apps/api` và
`apps/worker`** — pool kết nối hiện có vẫn dùng mật khẩu cũ cho tới khi tạo connection mới,
restart để đảm bảo toàn bộ pool dùng mật khẩu mới ngay, tránh tình trạng 1 phần request dùng
credential cũ đang hết hạn dần.

**Ảnh hưởng khi xoay:** downtime ngắn của `apps/api`/`apps/worker` trong lúc restart (vài
giây, theo đúng quy trình PID-kill rồi khởi động lại đã dùng xuyên suốt phiên làm việc này).

## 3. `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — MinIO root credentials

**Nơi cấu hình:** `docker-compose.yml`'s `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` (khởi tạo lần
đầu, cùng hạn chế như Postgres ở mục 1) + `.env`'s `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`.

**Cách xoay (MinIO đã có dữ liệu, không thể chỉ đổi biến compose):**
```bash
docker exec r2m-v5-local-minio-1 mc admin user add local <access-key-mới> <secret-key-mới>
# gán quyền tương đương user hiện tại rồi mới vô hiệu hoá key cũ:
docker exec r2m-v5-local-minio-1 mc admin policy attach local readwrite --user <access-key-mới>
docker exec r2m-v5-local-minio-1 mc admin user disable local <access-key-cũ>
```
Cập nhật `.env`, restart `apps/api`/`apps/worker` (cả 2 đều tạo `S3Client` riêng —
`apps/api/src/common/storage/s3.service.ts` và `apps/worker/src/file-safety/s3-object.ts`).
Sau khi xác nhận hệ thống hoạt động bình thường với key mới, xoá hẳn key cũ
(`mc admin user remove`).

**Ảnh hưởng khi xoay:** downtime ngắn cho luồng upload/download trong lúc restart 2 app; nếu
làm đúng thứ tự trên (thêm key mới → chuyển app sang dùng → mới vô hiệu hoá key cũ) thì không
có khoảng gián đoạn nào cả, vì key cũ vẫn hoạt động song song tới bước cuối.

## 4. `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`

**Nơi cấu hình:** `.env`, đọc trực tiếp bởi module auth (`apps/api`) lúc ký/verify token — không
lưu trong DB.

**Cách xoay:** đổi giá trị trong `.env`, restart `apps/api`.

**Ảnh hưởng khi xoay — quan trọng, khác các mục trên:** đổi 1 trong 2 secret này làm **toàn bộ
access token/refresh token đã phát hành trước đó lập tức không còn verify được** — mọi người
dùng đang đăng nhập bị đăng xuất ngay khi request kế tiếp của họ chạy tới, không có "ân hạn"
nào (không có cơ chế 2-secret song song để verify token cũ trong lúc chuyển đổi, vì spec không
yêu cầu và JWT hiện tại đơn giản chỉ 1 secret mỗi loại). Vì vậy: chỉ xoay 2 secret này ngoài
giờ cao điểm, và báo trước cho người dùng nếu là môi trường có người dùng thật (không áp dụng
cho dev local hiện tại).

## 5. `RESEND_API_KEY`

**Nơi cấu hình:** `.env`, đọc bởi `apps/worker/src/email/resend-email-sender.ts`. Đây là key
của dịch vụ ngoài (Resend) — khác 4 mục trên, không tự sinh được, phải thao tác trên dashboard
Resend (resend.com) trước.

**Cách xoay:**
1. Tạo API key mới trên dashboard Resend.
2. Cập nhật `.env`, restart `apps/worker` (chỉ worker gửi email, không phải `apps/api`).
3. Xác nhận bằng 1 email test thật (worker fallback về `ConsoleEmailSender` nếu
   `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS`/`EMAIL_FROM_NAME` thiếu bất kỳ cái nào — nếu sau khi
   đổi key mà log worker báo đang dùng `ConsoleEmailSender`, đó là dấu hiệu 1 trong 3 biến env
   bị thiếu/sai, không phải key mới không hoạt động).
4. Vô hiệu hoá key cũ trên dashboard Resend sau khi xác nhận key mới hoạt động.

**Ảnh hưởng khi xoay:** downtime ngắn cho việc gửi email trong lúc restart worker; các email
đã enqueue vào `outbox_event` trước đó vẫn được gửi bình thường sau khi worker khởi động lại
(không mất, chỉ trễ).

## 6. `GF_SECURITY_ADMIN_PASSWORD` (Grafana admin, dev-only)

**Nơi cấu hình:** `docker-compose.yml`'s `grafana` service. Lưu ý: `GF_AUTH_ANONYMOUS_ENABLED:
"true"` + `GF_AUTH_ANONYMOUS_ORG_ROLE: Admin` hiện đang bật cho môi trường dev local — nghĩa
là ai truy cập được `http://localhost:3300` đều có quyền admin mà **không cần mật khẩu này ở
dev local hiện tại**. Đây là lựa chọn tiện lợi cho dev, disclosed rõ: **không phù hợp cho môi
trường có thể truy cập từ ngoài** — trước khi triển khai staging/production, việc đầu tiên là
tắt `GF_AUTH_ANONYMOUS_ENABLED` (đặt `"false"`), không chỉ đổi mật khẩu admin.

**Cách xoay (khi anonymous access đã tắt):** đổi `GF_SECURITY_ADMIN_PASSWORD`, restart
container `grafana` (mất cấu hình đăng nhập UI đã lưu trong session, không mất dashboard —
dashboard được provision từ file JSON, không lưu trong Grafana's internal DB).

## Secret hiện KHÔNG có trong hệ thống (disclosed, không tự thêm)

- **Redis** (`REDIS_URL=redis://localhost:6379`): không có authentication nào được cấu hình —
  đây là hiện trạng thật của stack hiện tại (dev local), không phải secret bị bỏ sót khỏi
  runbook này. Nếu triển khai môi trường có thể truy cập từ ngoài, đây là việc cần bổ sung
  (Redis `requirepass` + cập nhật `REDIS_URL`), nhưng không tự thêm trong Phase 7 vì đây là
  thay đổi hạ tầng ngoài phạm vi "xoay secret đã có".
- **ClamAV**: không có credential nào (giao thức INSTREAM không yêu cầu auth) — không có gì để
  xoay.
