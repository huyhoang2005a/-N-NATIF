# Runbook — Incident Response

Quy trình xử lý cho các lớp sự cố thực tế của hệ thống R2M V5, dựa trên đúng các cơ chế đã
xây trong Phase 7 (metrics, logs, tracing, RLS runbook, outbox backoff) — không phải một
danh sách lý thuyết. Sự cố Docker Desktop hết dung lượng đĩa dưới đây là sự cố thật đã xảy ra
và được xử lý trong chính phiên làm việc xây dựng Phase 7 này.

Mọi mục dưới đây theo cùng cấu trúc: **Triệu chứng → Nơi kiểm tra → Nguyên nhân thường gặp →
Cách xử lý → Phòng ngừa**.

## 1. Outbox backlog tăng dần (`outbox_dispatch_lag_seconds` vượt NFR p95 ≤30s)

**Triệu chứng:** Grafana dashboard "Worker & Outbox" (`infra/docker/grafana/dashboards/
worker-outbox.json`, `http://localhost:3300`) cho thấy `outbox_dispatch_lag_seconds` tăng
liên tục thay vì dao động quanh vài giây. Người dùng báo email/thông báo không tới hoặc tới
trễ.

**Nơi kiểm tra:**
- Prometheus (`http://localhost:9090`) query `outbox_dispatch_lag_seconds` và
  `rate(outbox_dispatch_total{outcome="failed"}[5m])`.
- Worker log (`pino`, structured) — tìm `"dispatch loop error"` hoặc `"dispatch cycle
  complete"` với `failed` cao bất thường.
- Jaeger (`http://localhost:16686`, service `r2m-worker`) — trace một `outbox_event` cụ thể
  qua `traceparent` cột trên bảng `outbox_event` để xem nó dừng ở bước nào (ví dụ gọi Resend
  timeout).

**Nguyên nhân thường gặp:**
- Worker process chết/không chạy (`docker ps`/`Get-CimInstance Win32_Process` không thấy
  process `apps/worker`) — outbox không ai xử lý cả, không phải lỗi backoff.
- Dependency hạ nguồn cụ thể (Resend, MinIO) down/timeout — `apps/worker/src/outbox-
  dispatcher.ts`'s exponential backoff (`BACKOFF_BASE_MS=5000`, cap `BACKOFF_MAX_MS=10min`,
  `DEFAULT_MAX_ATTEMPTS=5`) đang hoạt động đúng thiết kế (giãn cách thay vì spam mỗi 2s) —
  backlog tăng là **triệu chứng đúng của một dependency down**, không phải bug ở cơ chế backoff.
- Postgres pool bị treo — xem mục 4.

**Cách xử lý:**
1. Xác nhận worker process còn sống; nếu chết, khởi động lại theo đúng quy trình PID-kill
   Windows (xem `CLAUDE.md`/ghi chú vận hành — không dùng `TaskStop` để dừng tiến trình
   pnpm/tsx, dùng `Stop-Process` theo PID cụ thể, tránh để lại orphan).
2. Nếu backlog do dependency cụ thể down: sửa dependency đó trước (không "ép" outbox xử lý
   lại bằng tay khi downstream vẫn đang down — sẽ chỉ tạo thêm log lỗi).
3. Sau khi dependency phục hồi, backoff tự giảm dần trong các lần poll tiếp theo — không cần
   can thiệp thủ công vào bảng `outbox_event`.

**Phòng ngừa:** Dashboard "Worker & Outbox" nên được xem định kỳ (không có alerting engine
nào được cấu hình trong stack hiện tại — nếu triển khai production thật, đây là việc cần làm
thêm, không tự làm trong Phase 7 vì vượt phạm vi hạ tầng đã có).

## 2. Sự kiện outbox rơi vào `DEAD_LETTER`

**Triệu chứng:** `outbox_dispatch_total{outcome="dead_letter"}` (Prometheus) tăng — nghĩa là
1 sự kiện đã thử đủ `DEFAULT_MAX_ATTEMPTS=5` lần và bị worker bỏ cuộc vĩnh viễn (không tự
retry nữa).

**Nơi kiểm tra:**
```sql
-- chạy qua psql với DATABASE_URL (role r2m, không phải r2m_app — cần đọc audit_log liên quan)
SELECT id, event_type, attempt_count, last_error, created_at
FROM outbox_event WHERE status = 'DEAD_LETTER' ORDER BY created_at DESC;
```
Cột `last_error` chứa lỗi thật của lần thử cuối cùng.

**Nguyên nhân thường gặp:** lỗi dữ liệu vĩnh viễn (không phải lỗi mạng tạm thời) — ví dụ
payload tham chiếu 1 row đã bị xoá, hoặc lỗi logic thật trong handler tương ứng
(`apps/worker/src/outbox-dispatcher.ts`'s `switch (row.eventType)`).

**Cách xử lý:**
1. Đọc `last_error` để xác định lỗi thật (không đoán).
2. Nếu là bug có thể sửa (ví dụ handler thiếu 1 case) — sửa code, sau đó **thủ công** đặt lại
   `status = 'PENDING', attempt_count = 0` cho đúng (các) row đó để nó được thử lại — không
   có endpoint/script tự động để "requeue dead letter" trong Phase 7 (chưa build vì spec
   không yêu cầu cụ thể; nếu tần suất dead-letter cao trong thực tế, đây là ứng viên tốt cho
   Phase bảo trì sau).
3. Nếu là dữ liệu rác thật sự (ví dụ case đã bị xoá hợp lệ) — để nguyên ở `DEAD_LETTER`, đây
   không phải sự cố cần xử lý.

**Phòng ngừa:** review `last_error` các dead-letter mới định kỳ; dead-letter không tự dọn nên
số lượng dòng tích luỹ theo thời gian là bình thường (đây là log, không phải hàng đợi).

## 3. Rate limit chặn nhầm người dùng hợp lệ

**Triệu chứng:** Người dùng báo `429`/`SYSTEM_RATE_LIMITED` khi thao tác bình thường (login,
upload, tạo recommendation run, submit proposal).

**Nơi kiểm tra:** Prometheus `rate_limit_rejected_total{keyPrefix="..."}` — `keyPrefix` cho
biết endpoint nào đang chặn (`apps/api/src/common/guards/rate-limit.guard.ts`, key theo
`actor.userId` nếu đã đăng nhập, theo IP nếu chưa).

**Nguyên nhân thường gặp:**
- Nhiều người dùng sau cùng 1 NAT/IP công ty bị tính chung 1 khoá rate-limit (key theo IP chỉ
  áp dụng cho endpoint chưa đăng nhập, ví dụ `/auth/login`) — giới hạn hiện tại là số cấu hình
  vận hành tự chọn (disclosed trong plan Phase 7, không phải business rule từ spec), có thể
  chỉnh qua decorator `@RateLimit(...)` trên từng controller nếu giới hạn hiện tại quá chặt
  cho thực tế.
- Redis chết → `RedisModule`/guard fail — kiểm tra `docker ps` container `redis`; guard hiện
  tại fail dựa trên kết nối Redis thật (không có "fail-open" nào được code sẵn — nếu Redis
  down, xác nhận qua log lỗi cụ thể của guard trước khi kết luận đây là do rate-limit đúng
  nghĩa hay do hạ tầng Redis down).

**Cách xử lý:** nếu do Redis down, khởi động lại container Redis. Nếu do ngưỡng thật sự quá
chặt cho lưu lượng thực tế, chỉnh số trong decorator tương ứng, không chỉnh giá trị mặc định
mà không có lý do (đây là cấu hình vận hành, ghi lại lý do thay đổi vào commit message).

## 4. Postgres pool bị treo / worker hoặc api crash khi Postgres restart

**Triệu chứng:** `apps/api`/`apps/worker` process đột nhiên thoát hoàn toàn (không phải lỗi
log bình thường) đúng lúc container `postgres` restart hoặc mất kết nối tạm thời.

**Đây là sự cố có thật đã xảy ra trong quá trình build Phase 7** (không phải giả định): khi
Postgres container tự restart do áp lực tài nguyên Docker Desktop lúc load-test, tiến trình
`pg.Pool` phát ra sự kiện `'error'` trên 1 idle client — Node.js coi 1 unhandled `'error'`
event là uncaught exception và **crash toàn bộ process theo mặc định**, không chỉ riêng
connection đó. Đã sửa bằng `attachErrorHandler()` (`packages/database/src/client.ts`) gắn
listener `'error'` rõ ràng lên cả `getPool()` và `getAppPool()` — pool tự phục hồi khi
Postgres quay lại mà không crash cả app nữa.

**Nơi kiểm tra:** log cuối cùng trước khi process biến mất (nếu còn) — dấu hiệu đặc trưng là
không có `"worker fatal error"`/log lỗi NestJS bình thường nào, process chỉ đơn giản biến mất
khỏi danh sách tiến trình.

**Cách xử lý:** khởi động lại `apps/api`/`apps/worker` theo đúng quy trình PID-kill (xem mục
1). Nếu tái diễn thường xuyên dù đã có `attachErrorHandler()`, đây là dấu hiệu cần điều tra
sâu hơn (không phải fix lại bằng cách restart lặp lại) — có thể do 1 lỗi Postgres khác chưa
được listener hiện tại bắt.

**Phòng ngừa:** đã vá ở tầng code (`attachErrorHandler()`), không cần thao tác vận hành thêm
trừ khi tái diễn.

## 5. ClamAV down → mọi upload bị chặn hàng loạt

**Triệu chứng:** Toàn bộ upload resource/verification document thất bại đồng loạt (không
phải 1 file cụ thể) — `resource_ingestion_job.status = FAILED` với lỗi kết nối, không phải
`MALWARE_DETECTED`/`MIME_MISMATCH`.

**Nơi kiểm tra:** `docker ps` container `clamav` — nếu không `Up`/`healthy`, đây là nguyên
nhân. `packages/file-safety/src/scan-for-malware.ts` nói chuyện TCP trực tiếp với `clamd`
(`CLAMAV_HOST`/`CLAMAV_PORT`) — không có cơ chế "cho qua nếu ClamAV down" (đúng chủ đích bảo
mật: thà chặn nhầm còn hơn để lọt file chưa quét).

**Cách xử lý:** khởi động lại container `clamav` (`docker compose up -d clamav`). ClamAV cần
vài chục giây để nạp signature database sau khi start (`health: starting` → `healthy`) — chờ
healthcheck pass trước khi coi là đã khắc phục xong, đừng kết luận "vẫn lỗi" khi chỉ đang khởi
động.

## 6. RLS chặn nhầm (chỉ áp dụng sau khi RLS được bật thật — hiện tại CHƯA bật)

Xem toàn bộ quy trình chi tiết ở `docs/ops/RUNBOOK_ENABLE_RLS.md`, mục "Verifying after
enabling" và "Rolling back". Tóm tắt: nếu 1 request tự nhiên trả về rỗng dữ liệu mà trước đó
có, gần như chắc chắn là do session variable (`app.current_user_id`/`app.current_org_id`)
không được set đúng trên transaction đó — rollback về trạng thái RLS tắt luôn là lựa chọn an
toàn (`enable-rls.sql`'s trailing comment có sẵn câu lệnh `DISABLE ROW LEVEL SECURITY`).

## 7. Docker Desktop không khởi động được ("disk is full" / hết dung lượng ổ hệ thống)

**Sự cố có thật, mới xảy ra trong phiên xây dựng Phase 7 này** — ghi lại đầy đủ vì đây là lớp
sự cố vận hành thật trên máy dev Windows, không phải giả định.

**Triệu chứng:** `docker ps` báo `Docker Desktop is unable to start`. Toàn bộ container của
dự án (postgres/redis/minio/...) không truy cập được.

**Nơi kiểm tra:** `%LOCALAPPDATA%\Docker\log\host\monitor.log` (tail các dòng gần nhất) — lỗi
thật sẽ hiện rõ dạng `"...init.log: There is not enough space on the disk."` nếu đúng là hết
dung lượng. Kiểm tra dung lượng trống ổ chứa dữ liệu Docker (`Get-PSDrive C`).

**Nguyên nhân thường gặp:** ổ hệ thống (thường là C:) đầy — Docker Desktop cần ghi log/temp
lúc khởi động WSL2 backend, không khởi động được nếu ổ đó đầy hoàn toàn, **kể cả khi dữ liệu
Docker thật (`docker_data.vhdx`) đã được chuyển sang ổ khác** — vẫn cần một lượng nhỏ dung
lượng trống trên ổ hệ thống cho log/temp riêng của tiến trình Docker Desktop.

**Cách xử lý:**
1. Giải phóng dung lượng ổ hệ thống — ưu tiên các mục an toàn/hoàn nguyên được: cache npm/pnpm
   dư thừa (nếu đã cấu hình cache ở ổ khác), cache Windows Update
   (`C:\Windows\SoftwareDistribution\Download`, cần quyền admin), tắt tạm hibernation
   (`powercfg /hibernate off`, cần quyền admin, hoàn nguyên bằng `/hibernate on`). **Không**
   đụng vào bất kỳ file nào trong `AppData\Local\Docker\` khi Docker Desktop đang ở trạng thái
   lỗi — dữ liệu container/volume nằm trong đó.
2. Dừng sạch mọi tiến trình Docker (`Docker Desktop.exe`, `com.docker.backend.exe`,
   `docker-agent.exe`) trước khi khởi động lại — khởi động lại khi tiến trình cũ còn treo
   thường không tự phục hồi.
3. Khởi động lại Docker Desktop, xác nhận `docker ps` phản hồi, sau đó `docker compose up -d`
   lại các container của dự án.
4. **Xác minh dữ liệu còn nguyên** trước khi coi sự cố đã xong — không giả định: query số dòng
   1 vài bảng chính (`organization`, `technology_case`, `verification_document`) và so với số
   liệu đã biết trước sự cố.

**Nếu muốn chuyển hẳn dữ liệu Docker sang ổ khác (giảm nguy cơ tái diễn):** Settings →
Resources → Advanced → "Disk image location" trong chính Docker Desktop (yêu cầu Docker
Desktop khởi động được trước — đây là cách được hỗ trợ chính thức duy nhất; dữ liệu thật nằm
trong 1 file `.vhdx` không nằm trong distro WSL có thể export/import qua `wsl --export`, nên
không có cách thao tác qua dòng lệnh an toàn tương đương).

**Phòng ngừa:** theo dõi dung lượng trống ổ chứa Docker Desktop định kỳ nếu máy dev có ổ hệ
thống dung lượng nhỏ; đã disclose đây là rủi ro môi trường dev cụ thể của máy này, không phải
vấn đề kiến trúc phần mềm.
