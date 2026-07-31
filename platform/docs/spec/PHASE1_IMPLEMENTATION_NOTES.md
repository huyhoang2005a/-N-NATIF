# Phase 1 Implementation Notes (Identity & Organization, Verification)

Ghi lại những gì Claude Code đã dựng cho Phase 1, các quyết định lệch khỏi kế hoạch ban
đầu (và lý do), và phần còn dang dở — để phiên làm việc sau (người hoặc Claude) không
phải đọc lại toàn bộ lịch sử chat.

**Trạng thái tại thời điểm ghi chú này**: ổ C: của máy dev hết dung lượng (0 byte trống)
giữa lúc đang code, nên **chưa chạy được** `pnpm install`, `typecheck`, `lint`, `test`.
Toàn bộ code dưới đây mới chỉ được viết ra, chưa được biên dịch/verify.

## 1. Cấu trúc đã tạo

```
platform/                          <- monorepo root (pnpm + Turborepo)
  package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json
  eslint.config.js, .prettierrc, .env.example, vitest.config.ts
  infra/docker/docker-compose.yml  <- postgres (pgvector/pgvector:pg16), redis, minio
  packages/
    config/    — zod-validated env loader (@r2m/config)
    domain/    — enums, error codes, DomainError hierarchy, state machines (@r2m/domain)
    authz/     — ActorContext, platform-role + org-membership policies (@r2m/authz)
    contracts/ — zod DTOs + domain event payload types, shared web+api (@r2m/contracts)
    db/        — Drizzle schema + migrations + seed (@r2m/db) — xem §2 bên dưới
    testkit/   — resetDatabase() + factories cho integration test sau này (@r2m/testkit)
  apps/
    api/       — NestJS modular monolith: auth, users, organizations, verification, audit, jobs
    worker/    — outbox dispatcher (poll loop, chưa dùng BullMQ — xem §3)
    web/       — Next.js App Router: /, /login, /register-organization (rất tối giản)
  docs/openapi/v1/phase1.yaml — DỰ ĐỊNH viết nhưng bị ENOSPC giữa chừng, **chưa tồn tại**.
    Cần viết lại (nội dung đã soạn sẵn trong lịch sử chat, chưa lưu ra file).
```

## 2. Phạm vi schema DB — cố ý KHÔNG port toàn bộ 60 bảng

`docs/spec/schema_v5_production.dbml` có ~60 bảng / 8 bounded context. `packages/db` mới
chỉ định nghĩa (Drizzle) phần Phase 1:

- Identity & Organization: `user_account`, `user_identity`, `user_profile`, `organization`,
  `organization_domain`, `organization_member`
- Verification — **chỉ Organization verification**: `organization_verification_request`,
  `verification_document` (chỉ có FK tới `organization_verification_request_id`, CHƯA có
  `author_verification_request_id` + check constraint "exactly one non-null" — sẽ thêm ở
  Phase 2 khi `author_profile`/`author_verification_request` được tạo, additive migration)
- Platform Operations: `notification`, `audit_log`, `outbox_event`, `idempotency_key`

**Lý do lệch khỏi kế hoạch ban đầu** (kế hoạch cũ nói sẽ port toàn bộ baseline một lần
theo đúng tinh thần `V4_TO_V5_MIGRATION_PLAN.md`): phần schema cho Company&Discovery,
Resource&Evidence, Technology Case, Assessment&Gap, Roadmap&Transfer chưa được đọc kỹ
từng cột trong phiên làm việc này — port ẩu 40 bảng chưa đọc kỹ rủi ro sai cột/FK/enum mà
không có gì test được ngay. Quyết định: chỉ port phần đã đọc kỹ và có code dùng tới,
đúng tinh thần CLAUDE.md "không nhảy cóc module". Khi làm Phase 2, thêm
`schema/<bounded-context>.ts` mới + migration mới, không ALTER bảng đã có dữ liệu.

Hai lớp migration:
1. `packages/db/migrations/` — sinh bởi `drizzle-kit generate` (chưa chạy lần nào).
2. `packages/db/manual-migrations/0002_v5_constraints.sql` — tay viết, cho trigger
   `updated_at`/`version`, partial unique index (`uq_one_active_org_owner`,
   `uq_one_pending_org_verification`, `uq_notification_dedupe`), `idx_pending_outbox`.
   Áp dụng qua `src/migrate.ts`, tự track file đã chạy trong bảng `_manual_migration`.

`packages/db/src/seeds/run.ts`: tạo 1 platform admin (`admin@r2m.local` /
`ChangeMe123!`) + 1 organization ACTIVE mẫu (`sample-research-unit`).

## 3. Quyết định/đơn giản hoá đáng chú ý khác

- **Không dùng BullMQ/Redis ở Phase 1**: `apps/worker` là một vòng poll đơn giản đọc
  `outbox_event` (PENDING/FAILED, `available_at` đã qua) mỗi 2s, chuyển event thành
  `notification` row. Lý do: chưa có job nào thực sự cần hàng đợi/backoff (ingestion,
  embedding, gửi email — đều là Phase 2+). Khi có job như vậy, quay lại dùng
  Redis/BullMQ như CLAUDE.md yêu cầu.
- **Auth là stateless JWT** (access 15' + refresh 30 ngày ký bằng `jsonwebtoken`), **không
  có bảng session/refresh-token** vì schema_v5_production.dbml không định nghĩa entity đó.
  `POST /auth/logout` vì vậy là no-op phía server (client tự xoá token) — không tự bịa
  ra một bảng session ngoài spec.
- **`POST /organizations/register` không áp dụng được `IdempotencyService`** dùng chung:
  bảng `idempotency_key.user_id` là NOT NULL, nhưng actor của UC-ORG-01 là Guest (chưa có
  user). Giải pháp tạm: bắt lỗi unique-violation (email/slug trùng) và trả
  `ORG_ALREADY_EXISTS`/`AUTH_EMAIL_ALREADY_REGISTERED` thay vì lỗi 500 thô — về cơ bản
  thoả acceptance criteria "request lặp không tạo org thứ hai", nhưng **đây là một khoảng
  trống thật của spec** đáng đưa ra quyết định chính thức (thêm bảng
  idempotency-cho-anonymous-request, hoặc chấp nhận dựa vào unique constraint).
- **`PATCH /organizations/{id}` (sửa profile chung)** và **`POST /me/email-change`**:
  chưa implement. Không có UC-ORG-02 nào mô tả đầy đủ invariant cho việc sửa profile tổ
  chức (chỉ có UC-ORG-01 đăng ký); email-change cần một luồng verification riêng chưa có
  trong Phase 1. Cố tình bỏ qua thay vì tự bịa rule, theo đúng CLAUDE.md.
- **2 error code mới không có trong spec gốc**, thêm vào
  `packages/domain/src/errors/error-codes.ts` vì cần thiết để tránh trả lỗi tự do:
  - `AUTH_EMAIL_ALREADY_REGISTERED` — email đã tồn tại khi đăng ký tổ chức mới.
  - `SYSTEM_IDEMPOTENCY_KEY_REUSED` — cùng Idempotency-Key nhưng khác payload.
- **"Auto-verification policy"** nhắc ở UC-ORG-01 bước 5 ("Tạo organization_verification_
  request nếu không thỏa auto-verification policy") **chưa được định nghĩa ở đâu trong
  spec** — Phase 1 luôn tạo verification request (coi như policy luôn = false). Cần người
  quyết định tiêu chí auto-verify thật (nếu có) trước khi coi UC-ORG-01 là "xong" 100%.
- Endpoint xác minh tổ chức đặt tại `/v1/platform/organization-verifications/...` — đặt
  tên tương tự nhưng KHÔNG có trong bảng API catalogue §13.2 gốc (catalogue chỉ liệt kê
  path cho author-verification). Đây là suy luận hợp lý theo cùng pattern, không phải
  nguyên văn spec — cần xác nhận lại khi viết OpenAPI chính thức.

## 4. Việc còn lại ngay khi có ổ đĩa trống

1. Viết lại `docs/openapi/v1/phase1.yaml` (bị mất do ENOSPC).
2. `pnpm install` ở root, rồi `pnpm --filter @r2m/db generate` (sinh migration baseline
   thật từ Drizzle schema), review file SQL sinh ra.
3. `pnpm typecheck` / `pnpm lint` / `pnpm test` toàn repo — **chưa từng chạy lần nào**,
   nhiều khả năng có lỗi type nhỏ cần sửa, đặc biệt quanh kiểu `tx` trong
   `db.transaction(async (tx) => ...)` truyền xuống các repository (khai báo tham số kiểu
   `Database` nhưng Drizzle trả về kiểu transaction hơi khác — đã ghi chú rủi ro này lúc
   viết code, chưa xác nhận bằng `tsc` thật).
4. `docker compose -f infra/docker/docker-compose.yml up -d`, `pnpm db:migrate`,
   `pnpm db:seed`, sau đó thử tay `apps/api` (`pnpm --filter @r2m/api dev`) với UC-ORG-01
   qua curl/Postman thật trước khi coi Phase 1 là "xong" (CLAUDE.md yêu cầu 3 việc: domain
   invariant, unit test, event/audit — mới có 2 việc đầu được viết, chưa chạy integration
   test thật với Postgres).
5. Sau khi review, xoá file ghi chú này hoặc gộp nội dung còn giá trị vào
   `USE_CASE_COVERAGE_MATRIX.md` — đây là note tạm thời của phiên code, không phải tài
   liệu spec chính thức.
