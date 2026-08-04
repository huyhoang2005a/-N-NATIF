# Phase 1 Implementation Notes (Identity & Organization, Verification)

Ghi lại những gì Claude Code đã dựng cho Phase 1, các quyết định lệch khỏi kế hoạch ban
đầu (và lý do), và phần còn dang dở — để phiên làm việc sau (người hoặc Claude) không
phải đọc lại toàn bộ lịch sử chat.

**Trạng thái tại thời điểm ghi chú này (2026-08-04, cập nhật lần 4)**: đã chuyển toàn bộ
việc build/temp sang ổ D: (ổ C: vẫn đầy, chưa xử lý ở tầng hệ điều hành). `pnpm install`,
`typecheck`, `lint`, `test`, `build` **đều đã chạy và pass** — xem §5. Docker Desktop +
WSL2 đã cài xong, `docker compose up -d` chạy Postgres/Redis/MinIO thật, `pnpm db:migrate` +
`db:seed` **đã chạy thành công** (sau khi sửa bug thứ tự migration — §7). **UC-ORG-01 đã
verify end-to-end qua HTTP thật** (register → login → `/v1/me` với JwtAuthGuard, audit_log +
outbox_event ghi đúng trong Postgres thật) — xem §8. Trong lúc đó phát hiện bug nghiêm
trọng nhất phiên này: `pnpm --filter @r2m/api dev` (`tsx watch`) trả 500 ở MỌI route dù boot
sạch, vì (a) một đợt `eslint --fix` trước đây đổi nhầm import cần cho NestJS DI thành `import
type` (đã sửa) và (b) esbuild (dùng bởi `tsx`) không emit đúng `emitDecoratorMetadata` cho
NestJS (giới hạn công cụ, không sửa được — đã đổi hẳn sang quy trình build+node, xem §8.6).
Pipeline `typecheck`/`lint`/`test`/`build` trước đó đều xanh nhưng không hề phát hiện được
bug này, vì unit test toàn mock DI, chưa ai từng thực sự boot app qua Nest container thật
với Postgres thật cho tới hôm nay.

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
  user). Giải pháp tạm: bắt lỗi unique-violation (email/slug trùng, hoặc — phát hiện thêm ở
  §8.6 — domain trùng) và trả `ORG_ALREADY_EXISTS`/`AUTH_EMAIL_ALREADY_REGISTERED` thay vì
  lỗi 500 thô — về cơ bản thoả acceptance criteria "request lặp không tạo org thứ hai",
  nhưng **đây là một khoảng trống thật của spec** đáng đưa ra quyết định chính thức (thêm
  bảng idempotency-cho-anonymous-request, hoặc chấp nhận dựa vào unique constraint) — và
  message lỗi generic (`ORG_ALREADY_EXISTS`) hiện không phân biệt được "trùng tên org" vs
  "trùng domain email", xem §8.6.
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

1. ~~Viết lại `docs/openapi/v1/phase1.yaml` (bị mất do ENOSPC).~~ **Xong** — xem §5.1.
2. ~~`pnpm install` ở root, rồi `pnpm --filter @r2m/db generate` (sinh migration baseline
   thật từ Drizzle schema), review file SQL sinh ra.~~ **Xong** — xem §5.2.
3. ~~`pnpm typecheck` / `pnpm lint` / `pnpm test` toàn repo~~ **Xong, cả 3 đều pass** —
   xem §5.3–§5.5. Rủi ro nêu ở lần ghi trước (kiểu `tx` trong
   `db.transaction(async (tx) => ...)`) **không xảy ra** — `tsc` không phàn nàn gì ở điểm
   này; các lỗi thật gặp phải là loại khác (liệt kê ở §5.3).
4. ~~Cài Docker/WSL2, chạy `db:migrate`/`db:seed`, thử tay `apps/api` với UC-ORG-01 qua
   curl thật~~ **Xong** — xem §7, §8.

## 5. Nhật ký phiên xử lý sau ENOSPC (2026-08-04)

### 5.1 OpenAPI

Viết lại `docs/openapi/v1/phase1.yaml` từ đầu (nội dung bị mất hoàn toàn, không có bản nháp
nào sống sót trên đĩa). Khớp với các endpoint đã có trong `apps/api/src/modules/*`.

### 5.2 Migration baseline

`pnpm --filter @r2m/db generate` chạy sạch, sinh `migrations/0000_lying_hedge_knight.sql`
khớp đúng 12 bảng mô tả ở §2 (Identity & Organization, Verification, Platform Operations).
Đã review SQL sinh ra, khớp schema Drizzle.

### 5.3 `pnpm typecheck` — lỗi gặp phải và cách sửa

1. **Lỗi cấu hình TS lan toàn repo (TS6059, `rootDir`)**: mọi `tsconfig.json` trong
   `packages/*`/`apps/*` set `rootDir: "src"` trong khi `tsconfig.base.json` lại path-map
   `@r2m/*` thẳng vào `packages/*/src` (source thô) — khiến TS coi file của package khác là
   "ngoài rootDir". Đây là lỗi cấu hình có thật, không phải false positive.
   **Cách sửa đã chọn (theo yêu cầu người dùng — sửa tận gốc, không chỉ tắt warning)**:
   dựng lại đúng chuẩn **TypeScript Project References**. Xem chi tiết ở §5.6.
2. **`noUncheckedIndexedAccess` (đã bật sẵn trong `tsconfig.base.json`) lộ ra nhiều chỗ
   `const [row] = await db.insert(...).returning()` không kiểm tra `row` có thể
   `undefined`**: `packages/testkit/src/factories.ts`, `packages/db/src/seeds/run.ts`,
   `apps/api/src/modules/organizations/{organizations.repository.ts,slug.util.ts}`,
   `apps/api/src/modules/users/users.repository.ts`,
   `apps/api/src/modules/verification/verification.repository.ts`. Sửa bằng cách throw rõ
   ràng khi insert/update không trả về row nào (thêm helper `firstOrThrow` trong
   `organizations.repository.ts`) — hành vi lúc lỗi rõ hơn trước (throw có message thay vì
   `undefined` len lỏi xuống response).

### 5.4 `pnpm lint` — gap có thật, không phải lỗi code

Chưa package nào từng có script `"lint"` — `turbo run lint` luôn no-op (0 task chạy) dù
`eslint.config.js` (flat config) đã tồn tại sẵn ở root từ trước. Sửa: đổi script `lint` ở
root `package.json` thành gọi thẳng `eslint .` (bỏ `lint` khỏi `turbo.json` vì không còn
dùng). Sau đó `eslint .` báo 19 lỗi `@typescript-eslint/consistent-type-imports`, tất cả
tự sửa được bằng `eslint . --fix`. Riêng `apps/web/next-env.d.ts` (file Next.js tự sinh,
không được sửa tay) báo lỗi `triple-slash-reference` — thêm vào `ignores` của eslint config
thay vì sửa file.

**Lưu ý quan trọng (biết được sau, xem §8.2)**: chính đợt `--fix` này đã âm thầm phá
NestJS dependency injection trong `apps/api` bằng cách đổi các import class cần cho
`emitDecoratorMetadata` thành `import type`. Không phát hiện được ở thời điểm này vì không
có gì boot thử app thật.

### 5.5 `pnpm test` — 2 gap môi trường + 1 bug test thật

1. `vitest.config.ts` ở root import `"vitest/config"` nhưng `vitest` chưa từng là
   devDependency của root `package.json` (chỉ có ở từng package con) — dưới pnpm strict
   node_modules, root không resolve được. Thêm `"vitest": "^2.1.8"` vào root
   devDependencies.
2. `apps/api/src/modules/verification/verification.service.spec.ts`: 2 test case mock
   `verificationRepository.decide()` trả về object thiếu field `submittedAt`/`reviewedAt`,
   trong khi `toResponse()` gọi `request.submittedAt.toISOString()` không optional — bug ở
   **test data**, không phải ở `verification.service.ts`. Đã bổ sung mock đầy đủ field.

Sau khi sửa cả 3, `pnpm typecheck` / `pnpm lint` / `pnpm test` đều pass 100% (test: 12/12
task, 60 test case).

### 5.6 TS Project References — sửa tận gốc build pipeline

Phát hiện thêm: `turbo.json` từ trước đã có `"typecheck"`/`"test"` với
`"dependsOn": ["^build"]`, tức ý đồ ban đầu là build package phụ thuộc (ra `dist/*.d.ts`)
trước rồi mới typecheck/test package phụ thuộc vào nó — đúng mô hình TS Project References
chuẩn. Nhưng việc này chưa từng được hoàn thiện: chưa package nào có script `"build"`, và
`tsconfig.base.json` path-map thẳng vào `src` (source thô) thay vì `dist` (declaration đã
build) — hai nửa cấu hình không khớp nhau, và **đây chính là nguyên nhân gốc của lỗi
`rootDir` ở mục 5.3.1**.

Đã hoàn thiện đúng mô hình:
- `packages/{config,domain,authz,contracts,db,testkit}`: thêm `"composite": true`,
  `rootDir: "src"`, `outDir: "dist"` vào tsconfig; thêm script `"build": "tsc -p
  tsconfig.json"`; đổi `package.json` `"main"`/`"types"` từ `"src/index.ts"` sang
  `"dist/index.js"`/`"dist/index.d.ts"`; thêm `"references"` trỏ đúng dependency
  (`authz`→`domain`, `contracts`→`domain`, `db`→`config`, `testkit`→`db`).
- `tsconfig.base.json`: path-map `@r2m/*` đổi từ trỏ `src` sang trỏ `dist`.
- `apps/api`, `apps/worker`: khôi phục `rootDir: "src"` (giờ hợp lệ vì chương trình biên
  dịch của app chỉ còn gồm file của chính nó + `.d.ts` đã build của các package, không kéo
  source thô của package khác vào nữa); thêm `"references"` trỏ đúng package phụ thuộc.

**Đã verify bằng build thật, không chỉ tin lý thuyết**: `pnpm build` chạy đúng thứ tự phụ
thuộc qua turbo, sinh `dist/` cho toàn bộ 9 package/app (kể cả `next build` cho `apps/web`).
Chạy thử `node apps/api/dist/main.js` trực tiếp — require đúng
`packages/config/dist/env.js` đã build (resolve qua workspace symlink + `package.json
main`), dừng lại đúng chỗ vì thiếu biến môi trường thật (chưa có `.env`) — tức pipeline
build/start **lần đầu tiên thực sự chạy được**, trước đây chưa ai verify được việc này.

## 6. Việc còn lại (cập nhật 2026-08-04, lần 4)

1. ~~Cài Docker Desktop trên máy dev~~ **Xong** — xem §7.1.
2. ~~`docker compose up -d`, tạo `.env` thật, `pnpm db:migrate`, `pnpm db:seed`~~ **Xong** —
   xem §7.2–§7.3.
3. ~~Thử tay `apps/api` với UC-ORG-01 qua curl thật~~ **Xong, pass** — xem §8. ~~Cần quyết
   định hướng dev server~~ **Đã quyết (2026-08-04): dùng build+node làm quy trình chính
   thức** — xem §8.6.
4. Các khoảng trống spec đã ghi ở §3 vẫn còn nguyên, chưa có quyết định chính thức: policy
   idempotency cho anonymous register, `PATCH /organizations/{id}`, `POST
   /me/email-change`, tiêu chí auto-verification, path
   `/v1/platform/organization-verifications/...` chưa có trong API catalogue gốc, message
   lỗi `ORG_ALREADY_EXISTS` không phân biệt trùng tên vs trùng domain (§8.6).
5. Sau khi review, xoá file ghi chú này hoặc gộp nội dung còn giá trị vào
   `USE_CASE_COVERAGE_MATRIX.md`.

## 7. Nhật ký phiên Docker/WSL2 + migration thật đầu tiên (2026-08-04)

### 7.1 Cài đặt

WSL2 (`wsl --install --no-distribution`, chạy PowerShell admin) + Docker Desktop (chọn
"Use WSL 2 instead of Hyper-V") — user tự cài theo hướng dẫn trong hội thoại, không có gì
bất thường. `docker --version` → 29.6.2. `wsl -l -v` → distro nội bộ `docker-desktop`
running.

### 7.2 `docker compose up -d`

`infra/docker/docker-compose.yml` chạy sạch: `postgres` (pgvector/pgvector:pg16) và
`redis` lên `healthy`, `minio` lên `Up` (không có healthcheck khai báo trong compose file
nên không có trạng thái healthy/unhealthy, chỉ "Up" — không phải lỗi).

### 7.3 Bug thật phát hiện khi chạy `pnpm db:migrate` lần đầu — thứ tự tạo extension sai

`src/migrate.ts` chạy `migrate()` (drizzle-kit baseline, `migrations/0000_*.sql`) **trước**
`applyManualMigrations()` (`manual-migrations/0002_v5_constraints.sql`). Nhưng
`0000_*.sql` đã dùng type `citext` (cột `user_account.primary_email` và tương tự) ngay từ
`CREATE TABLE` đầu tiên, trong khi lệnh `CREATE EXTENSION IF NOT EXISTS citext;` chỉ nằm
trong `0002_v5_constraints.sql` — tức extension chỉ được tạo **sau** khi baseline đã chạy
xong. Trên một Postgres sạch (chưa từng bật `citext`), migrate luôn fail ngay bước đầu:
`error: type "citext" does not exist`. Đây là bug thật của pipeline migration, không phải
do thiếu extension cài sẵn trong image — image `pgvector/pgvector:pg16` có sẵn contrib
module `citext`, chỉ là chưa ai `CREATE EXTENSION` nó đúng lúc.

**Sửa**: thêm hàm `ensureExtensions()` trong `src/migrate.ts`, chạy
`CREATE EXTENSION IF NOT EXISTS pgcrypto/citext` **trước** `migrate()`. Bỏ 2 dòng
`CREATE EXTENSION` trùng lặp khỏi `manual-migrations/0002_v5_constraints.sql` (comment lại
lý do), cập nhật comment ở `packages/db/src/schema/custom-types.ts` trỏ đúng chỗ extension
được tạo. Chạy lại `pnpm db:migrate` — pass, tạo đủ 13 bảng (12 bảng nghiệp vụ +
`_manual_migration`) trong `r2m_dev`. `pnpm test` toàn repo sau khi sửa vẫn 12/12 task pass
(không có test nào phụ thuộc trực tiếp vào thứ tự này vì unit test hiện tại toàn mock
repository, không đụng Postgres thật — đây cũng là lý do bug này không bị bắt sớm hơn).

### 7.4 `.env`

Chưa từng có `.env` thật, chỉ có `.env.example`. Lưu ý: `packages/config/src/env.ts`
**không tự load file `.env`** (không dùng `dotenv`) — chỉ đọc thẳng `process.env`. Muốn
chạy `db:migrate`/`db:seed`/`apps/api dev` bằng tay ngoài Docker phải tự export biến môi
trường vào shell trước (hoặc thêm `dotenv`/`dotenv-cli` vào pipeline nếu muốn tự động —
chưa làm, ghi nhận là gap tiềm năng cho phiên sau).

## 8. Bug nghiêm trọng phát hiện khi test tay UC-ORG-01 qua HTTP thật (2026-08-04)

### 8.1 Triệu chứng

`pnpm --filter @r2m/api dev` (chạy `tsx watch src/main.ts`) boot sạch, log đủ route mapped,
`NestApplication successfully started` — nhìn giống hệt chạy đúng. Nhưng **mọi request HTTP,
kể cả route `@Public()`** (`POST /v1/organizations/register`), trả `500 Internal server
error`. Log thật: `TypeError: Cannot read properties of undefined (reading
'getAllAndOverride')` tại `JwtAuthGuard.canActivate` (`this.reflector` là `undefined`).

### 8.2 Nguyên nhân gốc #1 (đã sửa) — `import type` xoá mất class cần cho NestJS DI

`JwtAuthGuard` (và, hoá ra, **gần như mọi controller/service trong `apps/api`**) inject
dependency qua constructor **không có `@Inject(token)` tường minh** — NestJS dựa vào
`emitDecoratorMetadata` (đọc type của tham số constructor lúc runtime) để biết inject class
nào. Đợt `eslint . --fix` ở §5.4 (bật `@typescript-eslint/consistent-type-imports`) đã tự
động đổi **toàn bộ** import chỉ dùng làm type — kể cả `Reflector` (`@nestjs/core`) và mọi
`@Injectable()` service/repository tự viết — thành `import type`. Về mặt TypeScript compile
không sai (chỉ dùng làm type annotation), nhưng nó xoá mất class thật khỏi output JS, nên
metadata reflect được của NestJS không còn trỏ đúng class → DI âm thầm đưa `undefined` vào
thay vì instance thật, **không có lỗi bootstrap nào cả**, chỉ crash khi request thật gọi tới.

Đây là gap thật của cả 3 lớp kiểm tra tưởng đã "pass" trước đó:
- `tsc` không bắt được vì đây là hành vi runtime của decorator metadata, không phải type
  error.
- `eslint` không bắt được vì chính rule của nó gây ra bug.
- Unit test (`*.spec.ts`) không bắt được vì **tất cả đều `new Service(mockRepo, ...)` thủ
  công**, không đi qua `NestFactory`/DI container thật — đúng nguyên nhân ghi ở dòng đầu
  file note này ("audit_log/outbox_event chưa verify bằng Postgres thật").

**Đã sửa 2 lớp**:
1. Đổi lại `import type` → `import` giá trị thật cho đúng 13 chỗ bị ảnh hưởng (guard,
   4 controller, 4 service — danh sách đầy đủ trong git diff của phiên này):
   `common/guards/jwt-auth.guard.ts` (`Reflector`, `TokenService`),
   `modules/auth/{auth.controller,auth.service}.ts` (`AuthService`, `AuthRepository`,
   `TokenService`), `modules/organizations/{organizations.controller,organizations.service}.ts`
   (`OrganizationsService`, `OrganizationsRepository`, `AuditService`, `OutboxService`),
   `modules/users/{users.controller,users.service}.ts` (tương tự),
   `modules/verification/{verification.controller,verification.service}.ts` (tương tự).
2. **Sửa tận gốc, không chỉ patch chỗ đang lỗi**: thêm override trong `eslint.config.js` tắt
   `@typescript-eslint/consistent-type-imports` cho toàn bộ `apps/api/src/**/*.ts` (trừ
   `*.spec.ts`, nơi luôn construct thủ công nên an toàn với cả 2 kiểu import) — vì đây là
   bẫy sẽ tái diễn với BẤT KỲ service/repository mới nào được thêm sau này rồi lỡ chạy
   `eslint --fix`. `pnpm lint` sau khi thêm override vẫn pass sạch.

### 8.3 Nguyên nhân gốc #2 — `tsx`/esbuild không emit đúng decorator metadata

Sau khi sửa toàn bộ import ở §8.2, **`pnpm --filter @r2m/api dev` (tsx watch) vẫn crash y
hệt**, kể cả restart hoàn toàn sạch (`taskkill node`, xoá log, start lại từ đầu — loại trừ
watch-mode cache stale). Test chéo: `pnpm --filter @r2m/api build` (dùng `tsc` thật, không
qua esbuild) rồi `node apps/api/dist/main.js` chạy **đúng hoàn toàn** — UC-ORG-01 pass
end-to-end (xem §8.5). Kết luận: `tsx` (dùng esbuild để transpile on-the-fly) có giới hạn/bug
đã biết khi kết hợp `experimentalDecorators` + `emitDecoratorMetadata` với NestJS — esbuild
transpile từng file độc lập, không type-check toàn chương trình, nên không emit
`design:paramtypes` chính xác như `tsc`. Đây là giới hạn của **esbuild**, không phải bug
trong source code của repo — nhưng hệ quả thực tế là **script `dev` cũ của `apps/api` không
dùng được để chạy tay/debug NestJS qua HTTP thật**. Quyết định xử lý ở §8.6.

### 8.4 Vì sao đáng đưa vào note thay vì chỉ sửa và bỏ qua

Đây có thể là bug nghiêm trọng nhất được phát hiện trong toàn bộ dự án tới nay: **API "chạy
được", boot sạch, log đẹp, nhưng 100% request thật đều 500** — nếu không có phiên test tay
này (chỉ xảy ra vì máy dev vừa có Docker), không ai biết pipeline `typecheck`/`lint`/`test`/
`build` xanh hoàn toàn không đảm bảo app thật chạy được. Bài học cho phiên sau: **luôn `pnpm
build && node dist/main.js` + curl tối thiểu 1 route sau khi hoàn thành một module**, đừng
chỉ tin unit test mock.

### 8.5 Kết quả verify UC-ORG-01 end-to-end (Postgres thật, qua `dist/main.js`)

- `POST /v1/organizations/register` (Guest, `@Public()`) → `201`, tạo đúng
  `organization` (status `PENDING_VERIFICATION`), `organization_verification_request`
  (status `PENDING`), 2 `outbox_event` (`OrganizationRegistered`,
  `OrganizationVerificationRequested`), 1 `audit_log` row (`action=organization.register`).
- Đăng ký lần 2 cùng `ownerEmail` → `409 AUTH_EMAIL_ALREADY_REGISTERED` (không tạo org thứ
  hai) — đúng acceptance criteria idempotency ghi ở §3.
- `POST /v1/auth/login` → JWT access+refresh token hợp lệ.
- `GET /v1/me` có `Authorization: Bearer <token>` → `200`, đúng profile — chứng minh
  `JwtAuthGuard` (đọc lại user + membership từ Postgres mỗi request, không tin token) hoạt
  động đúng thiết kế ghi ở comment của guard.
- `GET /v1/me` không có token → `401 AUTH_UNAUTHENTICATED`.

### 8.6 Quyết định: build+node là quy trình `dev` chính thức (2026-08-04)

User chọn phương án đơn giản nhất trong §8.3: bỏ hẳn `tsx watch`, `apps/api` script `dev`
giờ là `"tsc -p tsconfig.json && node dist/main.js"` — build thật bằng `tsc` (đúng
`emitDecoratorMetadata`), chạy compiled output trực tiếp bằng `node`. Không còn auto-reload
khi sửa file; muốn thấy thay đổi phải Ctrl+C rồi chạy lại `pnpm --filter @r2m/api dev`. Đánh
đổi chấp nhận được vì **đúng hơn quan trọng hơn tiện** — bug ở §8.2/§8.3 chứng minh watch
mode tiện nhưng có thể âm thầm sai hoàn toàn.

Dọn theo: gỡ `tsx` khỏi `apps/api/package.json` devDependencies (không còn chỗ nào dùng),
`pnpm install` lại để cập nhật `pnpm-lock.yaml`. `packages/db` vẫn giữ `tsx` cho
`migrate`/`seed` script — không đụng tới (không phải NestJS, không qua `emitDecoratorMetadata`,
không có gì để lo).

Verify lại toàn bộ sau khi đổi: `pnpm typecheck`/`lint`/`test` vẫn xanh 100%; chạy
`pnpm --filter @r2m/api dev` từ đầu → `POST /v1/organizations/register` trả `201` thật (không
còn 500). Nhân tiện bắt được thêm 1 điều đáng chú ý (không phải bug, hành vi đúng thiết kế):
`organization_domain.domain` có **unique constraint toàn cục**
(`organization_domain_domain_unique`, không scope theo organization) — hai tổ chức không thể
cùng dùng một email domain để đăng ký (kể cả domain công cộng như `example.com`). Đúng tinh
thần domain-based verification của spec, nhưng message lỗi hiện tại (`ORG_ALREADY_EXISTS`,
"An organization or account with these details already exists.") không nói rõ nguyên nhân
thật là domain trùng — cùng loại gap đã ghi ở §3 (generic catch-all cho unique-violation),
chưa cần sửa ngay nhưng nên nhớ khi có người dùng domain email công cộng (gmail.com, ...) thử
đăng ký tổ chức thứ hai.
