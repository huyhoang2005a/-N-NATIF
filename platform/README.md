# R2M — Research-to-Market Platform

Tài liệu tổng hợp cho **Phase 1 + Phase 2** (Identity & Organization, Verification,
Resource Catalog & Evidence). Đọc file này trước khi chạy hoặc mở rộng dự án. Với
business rule/spec gốc, xem `CLAUDE.md` và `docs/spec/`.

---

## 1. Tổng quan

R2M là nền tảng đăng ký, xác minh tổ chức/tác giả và quản lý tài nguyên nghiên cứu phục
vụ hoạt động chuyển giao công nghệ, kết nối 4 nhóm tổ chức: **đơn vị nghiên cứu**,
**doanh nghiệp**, **cơ quan nhà nước**, **tổ chức hỗ trợ**. Phase 1 xây phần nền: đăng ký
tổ chức, xác thực người dùng, xác minh tổ chức thủ công bởi platform reviewer. Phase 2
thêm: xác minh tác giả, đăng ký/versioning resource (paper/dataset/model/...), annotation,
cấp quyền truy cập resource, tìm kiếm full-text.

Toàn bộ hệ thống cuối cùng có 8 bounded context (xem `docs/spec/
R2M_V5_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md`). Đã triển khai 4 context: **Identity &
Organization**, **Verification** (tổ chức + tác giả), **Platform Operations**, **Resource
Catalog & Evidence** (phần buildable của Phase 2 — không gồm Evidence/Citation-linking
tới Technology Case, thuộc Phase 3).

---

## 2. Kiến trúc thư mục & phân tầng

### 2.1 Sơ đồ monorepo

```
platform/                       pnpm + Turborepo workspace
├── apps/
│   ├── api/                    NestJS — modular monolith, REST /v1
│   ├── worker/                 Node process — outbox dispatcher (poll loop)
│   └── web/                    Next.js App Router — giao diện người dùng
├── packages/
│   ├── domain/                 Enum, error code, DomainError, state machine (không phụ thuộc framework)
│   ├── authz/                  ActorContext + policy kiểm tra quyền (platform role, org membership)
│   ├── contracts/               Zod DTO (request/response) + domain event payload — dùng chung web+api
│   ├── env/                     Zod-validate biến môi trường (process.env), không tự load .env
│   ├── database/                Drizzle schema + migration + seed — nguồn sự thật của DB
│   └── testkit/                resetDatabase() + factory dữ liệu test
├── infra/docker/                docker-compose.yml: postgres (pgvector), redis, minio
└── docs/spec/                   Spec gốc: kiến trúc, dbml, use case, error code...
```

### 2.2 Phân tầng trong `apps/api` (NestJS)

Mỗi bounded context = 1 thư mục dưới `src/modules/<context>/`. Context nhỏ (1 domain
concern) là 1 NestJS module phẳng ngay trong thư mục đó (vd `verification/`); context
gồm nhiều module con thì gom các module con vào chung thư mục + có thêm 1 **module
tổng hợp** `<context>.module.ts` re-export chúng, để `app.module.ts` chỉ cần import
đúng số bounded context đang tồn tại — không import lẻ module con:

```
modules/
├── identity-organization/
│   ├── auth/                              AuthModule (login, refresh, token)
│   ├── users/                             UsersModule (hồ sơ cá nhân)
│   ├── organizations/                     OrganizationsModule (đăng ký, thành viên)
│   └── identity-organization.module.ts    imports + exports 3 module trên
├── verification/                          1 module duy nhất (org + author verification)
└── platform-operations/
    ├── audit/                             AuditModule (audit_log)
    ├── jobs/                              JobsModule (outbox_event, idempotency_key)
    └── platform-operations.module.ts      imports + exports 2 module trên
```

Mỗi module con (vd `auth/`) theo đúng 1 khuôn mẫu 4 lớp:

```
auth/
├── auth.controller.ts   Tầng HTTP — nhận request, gọi service, không chứa business rule
├── auth.service.ts      Tầng nghiệp vụ — enforce invariant, state transition, ghi audit/outbox
├── auth.repository.ts   Tầng dữ liệu — duy nhất nơi gọi Drizzle/SQL trực tiếp
└── auth.module.ts       Khai báo provider cho NestJS DI container
```

- **Module tổng hợp phải `exports` lại các module con nó import** — nếu không, provider
  của module con (vd `TokenService` trong `AuthModule`) sẽ không "lộ" ra ngoài
  `IdentityOrganizationModule`, và bất kỳ chỗ nào cần inject nó từ ngoài bounded context
  (vd `JwtAuthGuard` đăng ký làm `APP_GUARD` toàn cục trong `AppModule`) sẽ crash lúc
  khởi động với lỗi `Nest can't resolve dependencies` — đây là bug thật đã gặp khi gom
  module (xem mục "Bug thật đã tìm và sửa" bên dưới).
- **`common/`** — cross-cutting: `JwtAuthGuard` (đọc lại user/membership từ DB mỗi
  request, không tin token), `ZodValidationPipe`, `domain-error.filter.ts` (map
  `DomainError` → HTTP response chuẩn `{ error: { code, message, ... } }`),
  `request-id.middleware.ts`.
- **`database/database.module.ts`** — cung cấp kết nối Drizzle qua token `DATABASE`,
  inject bằng `@Inject(DATABASE)`. Đánh dấu `@Global()` nên không cần export/import lại
  qua module tổng hợp như các module khác.
- State transition (`organization.status`, `verification_request.status`) **luôn đi qua
  state machine trong `packages/domain`**, controller/repository không tự set status.
  `packages/domain` là **shared kernel** dùng chung mọi bounded context (xem
  `packages/domain/README.md`) — business rule/state machine riêng của 1 bounded context
  (từ Phase 2 trở đi) đặt trong `modules/<context>/domain/`, không đặt ở
  `packages/domain`.

### 2.3 Luồng dữ liệu 1 request điển hình

```
apps/web (Next.js)
   │  fetch() → apps/web/lib/api-client.ts
   ▼
apps/api Controller  →  Zod validate (packages/contracts)
   ▼
apps/api Service     →  domain invariant + state machine (packages/domain)
   ▼                     policy check (packages/authz)
apps/api Repository   →  Drizzle (packages/database) → Postgres
   ▼
   ├─ audit_log (mọi transition)
   └─ outbox_event (nếu có tác động ngoài transaction)
         ▼
   apps/worker (poll mỗi 2s) → notification row
```

### 2.4 `packages/database` — 2 lớp migration

1. `migrations/` — sinh tự động bởi `drizzle-kit generate` từ `src/schema/*.ts`.
2. `manual-migrations/` — tay viết cho phần Drizzle không sinh được: trigger
   `updated_at`/`version`, partial unique index, `CREATE EXTENSION`. Chạy sau baseline,
   tự track trong bảng `_manual_migration` (chạy 1 lần, an toàn re-run).

### 2.5 `apps/web` — cấu trúc App Router

> Phase 2 (Author & Resource Catalog) chỉ làm backend (`apps/api` + `packages/database`
> + `packages/contracts`) — **không có trang web mới**, đã verify hoàn toàn qua HTTP
> thật (xem §4). Cấu trúc `app/` dưới đây vẫn dừng ở các trang Phase 1.

```
app/
├── layout.tsx              Font (next/font/google), metadata
├── globals.css             Design token + toàn bộ utility class (không dùng Tailwind)
├── page.tsx                Trang chủ
├── login/page.tsx
├── register-organization/page.tsx
├── dashboard/page.tsx                          Hồ sơ cá nhân + tổ chức của người dùng đã đăng nhập
├── platform/organization-verifications/page.tsx Xét duyệt tổ chức (reviewer/admin)
├── _components/            Component dùng chung (prefix "_" = Next.js không coi là route),
│                            gồm cả SiteHeader — thanh điều hướng biết trạng thái đăng nhập
└── _lib/                   Helper thuần phía client (vd slug preview)
lib/
├── api-client.ts           fetch wrapper; apiFetch (public) + authFetch (đính kèm token,
│                            tự refresh 1 lần khi hết hạn) → map lỗi HTTP thành ApiError
├── session.ts              Đọc/ghi/xoá access + refresh token trong localStorage
├── labels.ts                Map enum (loại tổ chức, trạng thái, vai trò...) sang tiếng Việt
└── error-messages.ts       Map error code (ổn định) → thông báo tiếng Việt cho người dùng
```

---

## 3. Hướng dẫn sử dụng

### 3.1 Yêu cầu môi trường

- Node.js 20.11–22.x, pnpm ≥ 9
- Docker Desktop (kèm WSL2 trên Windows) — chạy Postgres/Redis/MinIO local

### 3.2 Cài đặt lần đầu

```powershell
cd platform
pnpm install
Copy-Item .env.example .env      # rồi sửa giá trị nếu cần

docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed                      # tạo 3 tài khoản mẫu, xem bảng bên dưới
```

| Tài khoản | Mật khẩu | Vai trò | Dùng để test |
|---|---|---|---|
| `admin@r2m.local` | `ChangeMe123!` | `PLATFORM_ADMIN` | Xét duyệt tổ chức, có toàn quyền |
| `reviewer@r2m.local` | `ChangeMe123!` | `PLATFORM_REVIEWER` | Xét duyệt tổ chức (vai trò chuyên viên riêng, không phải admin) |
| `owner@sample-research-unit.local` | `ChangeMe123!` | `USER` (chủ 1 tổ chức mẫu đã `ACTIVE`) | Xem `/dashboard` với tư cách người dùng thường; cũng dùng để test xác minh tác giả + đăng ký resource ở Phase 2 |

> Phase 2 không thêm tài khoản seed mới — dùng lại `owner@sample-research-unit.local`
> cho toàn bộ luồng tác giả/resource. Bucket MinIO (`S3_VERIFICATION_BUCKET`,
> `S3_RESOURCE_BUCKET`) được `S3Service` tự tạo (`HeadBucketCommand`/
> `CreateBucketCommand`) ở lần gọi đầu tiên — không cần provisioning tay trong
> `docker-compose.yml`.

> **`packages/env/src/env.ts` không tự load `.env`** (không dùng `dotenv`). Mỗi
> terminal PowerShell mới phải nạp biến môi trường thủ công trước khi chạy `api`/`db:*`:
> ```powershell
> Get-Content .env | ForEach-Object {
>     if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
>         Set-Item -Path "Env:$($matches[1].Trim())" -Value $matches[2].Trim()
>     }
> }
> ```

### 3.3 Chạy dev — cần 2 terminal riêng (API và web dùng port khác nhau)

**Terminal 1 — API** (port 3000, script `dev` = build thật bằng `tsc` + `node dist/main.js`,
xem lý do ở §5):
```powershell
cd platform
pnpm --filter @r2m/api dev
```

**Terminal 2 — Web** (port 3001 vì API đã chiếm 3000):
```powershell
cd platform/apps/web
npx next dev -p 3001
```

Mở `http://localhost:3001`. Các trang chính: `/` (trang chủ), `/register-organization`
(đăng ký tổ chức), `/login` → sau khi đăng nhập chuyển tới `/dashboard` (hồ sơ cá nhân +
tổ chức), và `/platform/organization-verifications` (xét duyệt tổ chức — chỉ hiện với
tài khoản `PLATFORM_REVIEWER`/`PLATFORM_ADMIN`, tài khoản `USER` thường truy cập trực
tiếp URL này sẽ bị chuyển hướng về `/dashboard`).

**Worker (tuỳ chọn, chỉ cần nếu muốn outbox event chuyển thành notification):**
```powershell
cd platform
pnpm --filter @r2m/worker dev
```

### 3.4 Script hay dùng

| Lệnh | Việc gì |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` toàn bộ package/app (qua Turborepo) |
| `pnpm lint` | ESLint toàn repo |
| `pnpm test` | Unit test toàn repo (Vitest) — **toàn bộ mock DI, không đụng Postgres thật** |
| `pnpm build` | Build tất cả theo đúng thứ tự phụ thuộc (TS Project References) |
| `pnpm db:generate` | Sinh migration mới từ thay đổi schema Drizzle |
| `pnpm db:migrate` / `pnpm db:seed` | Chạy migration / seed dữ liệu mẫu |

### 3.5 Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `ERR_CONNECTION_REFUSED` khi submit form | API chưa chạy hoặc đã thoát | Kiểm tra Terminal 1 còn treo ở dòng `listening on :3000`, chưa quay về prompt |
| Lỗi CORS trong Console | Web (3001) gọi API (3000) khác origin | Đã bật `app.enableCors()` trong `apps/api/src/main.ts` — nếu vẫn lỗi, restart lại Terminal 1 |
| `DATABASE_URL: Required` khi chạy `db:migrate`/`api dev` | Chưa nạp `.env` vào terminal | Xem lệnh nạp env ở §3.2 |
| `Couldn't find any pages or app directory` | Đang chạy `next dev` sai thư mục | Phải đứng trong `apps/web`, không phải `platform` root |
| `type "citext" does not exist` khi migrate | Không thể xảy ra nữa — đã sửa trong `migrate.ts` (xem §5) | — |

---

## 4. Đã làm được (Phase 1 + Phase 2)

### Phase 1

- **Domain & DB**: schema Drizzle cho Identity & Organization, Verification (chỉ tổ
  chức), Platform Operations — khớp `docs/spec/schema_v5_production.dbml`. State machine
  cho `organization` và `verification_request` trong `packages/domain`, tách khỏi
  framework.
- **API**: NestJS modular monolith — auth (JWT access/refresh), users, organizations
  (đăng ký + mời thành viên), verification (tổ chức), audit log, outbox event. Toàn bộ
  route đã verify **qua HTTP thật với Postgres thật** (không chỉ unit test mock):
  đăng ký → 201 + tạo đúng `organization`/`verification_request`/`outbox_event`/
  `audit_log`; đăng ký trùng → lỗi nghiệp vụ đúng mã; login → JWT hợp lệ; route có guard
  → 401 khi thiếu token, 200 khi có token đúng.
- **Web**: 5 trang (trang chủ, đăng nhập, đăng ký tổ chức, bảng điều khiển, xét duyệt tổ
  chức) với hệ thống thiết kế riêng (không dùng theme mặc định) — xem chi tiết token
  màu/typography trong `app/globals.css`. Có phiên đăng nhập đầy đủ: `SiteHeader` dùng
  chung nhận diện trạng thái đăng nhập + vai trò, `authFetch` tự refresh access token khi
  hết hạn (dùng `POST /auth/refresh` sẵn có ở API), đăng xuất xoá token cục bộ. Luồng xét
  duyệt tổ chức (`PENDING` → nhận xử lý → duyệt/từ chối) giờ thao tác được hoàn toàn qua
  giao diện, không cần gọi API tay.
- **Build pipeline**: TypeScript Project References đúng chuẩn (`composite: true`,
  build package phụ thuộc trước khi typecheck package phụ thuộc vào nó) — trước đó chưa
  từng hoàn thiện.
- **Hạ tầng dev**: `docker-compose.yml` (Postgres pgvector + Redis + MinIO), migration
  2 lớp (drizzle-kit + tay viết), seed data mẫu.
- `pnpm typecheck` / `pnpm lint` / `pnpm test` toàn repo đều pass.

### Phase 2

- **Restructure thư mục** (tiền đề cho Phase 2, không đổi business logic Phase 1):
  `packages/config`→`packages/env`, `packages/db`→`packages/database`, gom
  `auth`/`users`/`organizations` vào `modules/identity-organization/` và `audit`/`jobs`
  vào `modules/platform-operations/`, mỗi context có 1 module tổng hợp
  (`<context>.module.ts`) — xem §2.2. `verification/` giữ nguyên vị trí (đã là 1 context
  phẳng sẵn). Không xoá/mất chức năng nào của Phase 1 — verify lại bằng
  build/typecheck/lint/test toàn repo (xanh) + chạy lại đúng kịch bản HTTP thật của Phase
  1 (đăng ký → reviewer duyệt → dashboard).
- **Domain & DB**: 11 bảng mới (`author_profile`, `author_verification_request`,
  `resource`, `resource_version`, `paper_metadata`, `resource_ingestion_job`,
  `resource_chunk` — có cột `vector(1536)` cho pgvector, `citation`, `annotation`,
  `annotation_revision`, `resource_access_grant`) khớp
  `docs/spec/schema_v5_production.dbml`. `verification_document` mở rộng additive (FK
  tới cả org lẫn author verification request, exactly-one qua CHECK constraint) —
  không đụng dữ liệu Phase 1 đã có. State machine tác giả tái dùng
  `verification-request.state-machine.ts` sẵn có; state machine `Resource`/
  `ResourceVersion` là tự đề xuất (không có trong danh sách 10 state machine chính thức
  của spec), đặt trong `modules/resource-catalog/domain/` theo đúng ranh giới shared-
  kernel-vs-per-context đã lập ở §2.2.
- **API**: xác minh tác giả (upload tài liệu lên MinIO qua presigned URL → nộp → reviewer
  claim/xem tài liệu/duyệt), đăng ký resource + version (publish version đầu tiên tự
  chuyển resource `DRAFT`→`ACTIVE`), annotation (tạo/sửa qua revision mới — không sửa
  đè, xoá mềm), resource access grant (tạo/list/thu hồi), tìm kiếm full-text
  (`GET /resources?q=`, lọc theo quyền truy cập trước khi trả kết quả). Đây là lần đầu
  tiên repo thật sự gọi S3/MinIO (`@aws-sdk/client-s3`, `forcePathStyle: true` bắt buộc
  cho MinIO) — checksum tài liệu tính lại phía server bằng cách stream object, không tin
  giá trị client gửi lên. Toàn bộ luồng verify **qua HTTP thật với Postgres + MinIO
  thật** (kịch bản đủ 8 bước: xác minh tác giả → đăng ký resource → search → publish
  version 2 → annotation → access grant, xem `phase2-smoke.mjs`), không chỉ dựa vào 27
  unit test mock DI mới thêm.
- **OpenAPI**: `docs/openapi/v1/phase1.yaml` đổi tên thành `v1.yaml` (API versioned theo
  `/v1`, không theo phase nội bộ), thêm 18 path + ~20 schema mới, validate bằng script
  `js-yaml` xác nhận toàn bộ `$ref` resolve đúng (155/155).
- Có 4 điểm **tự đề xuất business rule** (spec chỉ có 1 dòng mô tả hoặc hoàn toàn không
  đề cập) — đánh dấu `// ĐỀ XUẤT — CẦN REVIEW` trong code, liệt kê chi tiết ở §5.

### Bug thật đã tìm và sửa trong phiên này (đáng nhớ cho phiên sau)

1. **Thứ tự tạo Postgres extension sai** — `migrate.ts` chạy baseline migration (dùng
   type `citext`) trước khi extension `citext` được tạo → luôn fail trên DB sạch. Sửa:
   thêm `ensureExtensions()` chạy trước `migrate()`.
2. **`eslint --fix` phá NestJS Dependency Injection** — rule
   `@typescript-eslint/consistent-type-imports` tự đổi import của class NestJS cần
   inject (service, repository, `Reflector`) thành `import type`, khiến
   `emitDecoratorMetadata` mất thông tin type → DI âm thầm inject `undefined`. App vẫn
   boot sạch, nhưng **100% request thật trả 500**. Không typecheck/lint/test nào bắt
   được vì unit test toàn mock DI. Đã sửa 13 chỗ + tắt rule này cho riêng
   `apps/api/src/**/*.ts` (trừ `*.spec.ts`) trong `eslint.config.js` để không tái diễn.
3. **`tsx watch` (esbuild) không tương thích NestJS decorator metadata** — dù đã sửa
   mục 2, `pnpm --filter @r2m/api dev` (chạy qua esbuild) vẫn crash y hệt vì esbuild
   transpile từng file riêng lẻ, không emit đúng `design:paramtypes`. Build bằng `tsc`
   thật + chạy `node dist/main.js` thì đúng. **Quyết định**: đổi hẳn script `dev` của
   `apps/api` thành `tsc -p tsconfig.json && node dist/main.js`, bỏ `tsx` khỏi
   dependencies — không còn hot-reload, nhưng đảm bảo đúng.
4. **`ZodValidationPipe` validate nhầm cả tham số route, không chỉ `@Body()`** — pipe
   dùng qua `@UsePipes()` cấp method áp dụng cho **mọi** tham số của handler. Bất kỳ
   route nào vừa có `@Param()` vừa dùng pattern này (`decide`, `inviteMember`,
   `updateMember`) đều luôn trả 400 `"Expected object, received string"` khi gọi thật,
   vì chuỗi id trong URL bị đem validate theo schema của body. Không unit test nào bắt
   được vì test gọi thẳng service, bỏ qua tầng pipe/HTTP hoàn toàn — chỉ lộ ra khi trang
   xét duyệt tổ chức mới (Phần "Hoàn thiện Phase 1") gọi `POST .../decision` qua trình
   duyệt thật. Sửa: `transform()` chỉ áp dụng schema khi `metadata.type === "body"`, các
   loại tham số khác trả nguyên giá trị. Thêm `zod-validation.pipe.spec.ts` để tránh tái
   diễn.
5. **Gom module theo bounded context làm mất provider export, app crash lúc khởi động**
   — khi gom `auth/`, `users/`, `organizations/` vào chung `modules/identity-
   organization/` và tạo module tổng hợp `IdentityOrganizationModule` chỉ có
   `imports: [AuthModule, ...]` (không có `exports`), `JwtAuthGuard` (đăng ký làm
   `APP_GUARD` toàn cục trong `AppModule`) không còn resolve được `TokenService` —
   NestJS không tự "lộ" provider của module con ra ngoài module cha chỉ vì cha import
   nó, phải khai báo `exports` tường minh. Lỗi này **build/typecheck/lint/test đều pass
   sạch** (đây là lỗi runtime DI graph, không phải lỗi kiểu TypeScript, và unit test
   dùng `new Service(...)` thủ công nên không đi qua NestJS DI) — chỉ lộ ra khi thật sự
   chạy `node dist/main.js`. Sửa: thêm `exports: [AuthModule, UsersModule,
   OrganizationsModule]` vào `IdentityOrganizationModule` (và tương tự cho
   `PlatformOperationsModule`). Bài học lặp lại đúng mẫu bug #2-#4 ở trên: mọi thay đổi
   cấu trúc module NestJS phải verify bằng chạy app thật, không chỉ tin build xanh.
6. **`tsconfig.base.json` tự sinh giá trị `"ignoreDeprecations": "6.0"` không hợp lệ** —
   khoá này xuất hiện lặp lại 2 lần trong phiên (không phải do tôi chủ động thêm), luôn
   ngay sau khi sửa block `paths`, gây `TS5103: Invalid value for '--ignoreDeprecations'`
   và phá build của **mọi** package cùng lúc (khoá nằm ở file base, ảnh hưởng toàn
   Project References graph). TypeScript 5.9.3 chỉ chấp nhận giá trị `"5.0"` cho khoá
   này, không phải `"6.0"`. Nghi do một tool/editor tự "fix" chèn nhầm — chưa xác định
   được chính xác nguồn. Sửa: xoá hẳn khoá này cả 2 lần; không tái diễn lần thứ 3. Nếu
   gặp lại `TS5103` sau khi sửa `tsconfig.base.json`, kiểm tra khoá này đầu tiên.
7. **Service gọi thẳng `loadEnv()` để lấy tên bucket S3 làm hỏng khả năng test** —
   `AuthorVerificationService`/`ResourcesService` gọi `loadEnv()` trực tiếp để đọc
   `env.S3_VERIFICATION_BUCKET`/`env.S3_RESOURCE_BUCKET` trước khi gọi `S3Service` (đã
   mock trong test) — khiến test luôn crash với `Invalid environment configuration:
   DATABASE_URL: Required...` dù `S3Service` được mock đầy đủ, vì `loadEnv()` chạy
   validate `process.env` thật ngay trong service, không đi qua mock nào. Vi phạm đúng
   precedent đã có với `TokenService` (luôn mock nguyên khối, không bao giờ gọi
   `loadEnv()` lẻ trong service khác). Sửa: chuyển việc đọc tên bucket vào constructor
   của `S3Service`, expose sẵn method theo bucket (`createVerificationUploadUrl`,
   `computeResourceContentSha256`...) để service gọi không cần biết tên bucket/không
   cần tự gọi `loadEnv()`.

---

## 5. Cần cải thiện cho Phase tiếp theo

### Ưu tiên cao — chặn hoặc gây trải nghiệm xấu

- **Không có cách "giành lại" một hồ sơ đã bị reviewer khác nhận nhưng bỏ dở** — API
  hiện chỉ cho reviewer đã claim quyết định, không có endpoint release/reassign. Đây là
  giới hạn có sẵn ở tầng API (`verification.service.ts`), trang xét duyệt chỉ phản ánh
  đúng hành vi đó chứ không tự thêm quyền mới.
- **CORS đang mở hoàn toàn** (`app.enableCors()` không giới hạn origin) — chỉ chấp nhận
  được cho local dev, cần cấu hình origin cụ thể trước khi có môi trường staging/prod.
- **Thông báo lỗi backend là tiếng Anh** — `apps/web/lib/error-messages.ts` đã map một
  số mã lỗi phổ biến sang tiếng Việt phía client, nhưng danh sách chưa đầy đủ (map theo
  `ErrorCode` trong `packages/domain/src/errors/error-codes.ts`); mã nào chưa map sẽ rơi
  vào thông báo chung chung.
- **`.env` không tự động nạp** — mỗi terminal mới phải export tay (xem §3.2). Nên thêm
  `dotenv`/`dotenv-cli` vào `apps/api`, `apps/worker`, `packages/database` nếu muốn bớt bước
  thủ công này.

### Khoảng trống spec chưa có quyết định chính thức

- **Idempotency cho `POST /organizations/register`**: actor là Guest (chưa có user) nên
  không dùng được `IdempotencyService` chung (yêu cầu `user_id` NOT NULL). Đang tạm dựa
  vào unique constraint (tên/slug, domain email) — cần quyết định có thêm bảng
  idempotency riêng cho anonymous request hay chấp nhận cách hiện tại.
- **`organization_domain.domain` unique toàn cục** (không scope theo tổ chức) — đúng
  tinh thần domain-based verification, nhưng 2 tổ chức dùng chung domain email công cộng
  (gmail.com...) sẽ không đăng ký được tổ chức thứ hai. Cần xác nhận đây có đúng là hành
  vi mong muốn không.
- **`PATCH /organizations/{id}`** (sửa profile chung) và **`POST /me/email-change`**:
  chưa implement — không có use case mô tả đủ invariant trong spec Phase 1.
- **Tiêu chí "auto-verification policy"** (nhắc ở UC-ORG-01) chưa được định nghĩa —
  hiện tại mọi tổ chức đăng ký đều luôn tạo verification request (coi như policy luôn
  false).

### Kỹ thuật / nợ kỹ thuật

- **Không có test nào chạy qua NestJS DI container thật** — toàn bộ `*.spec.ts` hiện tại
  `new Service(mockRepo, ...)` thủ công. Nên thêm ít nhất 1 bộ integration test dùng
  `@nestjs/testing` (`Test.createTestingModule`) + Postgres thật (`packages/testkit`) để
  bắt được lớp bug như mục "eslint phá DI" ở trên sớm hơn.
- **`apps/web` chưa có test nào** (không unit test component, không E2E). Có thể thêm
  Playwright cho luồng đăng ký/đăng nhập chính.
- **Không dùng Redis/BullMQ** dù đã có trong `docker-compose.yml` — `apps/worker` là
  poll loop đơn giản, đủ cho Phase 1+2 nhưng cần chuyển sang BullMQ khi có job cần
  backoff/retry thật (ingestion, embedding thật — Phase 2 chỉ tạo
  `resource_ingestion_job` ở trạng thái `QUEUED`, không có worker xử lý).
- **Chưa có CI** (không có `.github/workflows` hay pipeline nào chạy `typecheck`/`lint`/
  `test` tự động khi push).

### Phase 2 — business rule tự đề xuất, cần user review trước khi khoá

Spec cho các use case này chỉ có 1 dòng mô tả yêu cầu (không đủ 15 mục như UC chính) hoặc
hoàn toàn không đề cập — đã chọn cách làm hợp lý nhất theo enum/constraint đã khoá trong
`schema_v5_production.dbml`, đánh dấu `// ĐỀ XUẤT — CẦN REVIEW` tại chỗ trong code:

- **SUC-04 (Resource Access Grant)**: mô tả spec nói "request/approve" (ngụ ý có bước chờ
  duyệt) nhưng `AccessGrantStatus` trong schema chỉ có `ACTIVE/EXPIRED/REVOKED` — không
  có `PENDING`, không có bảng request riêng. Đã chọn: actor quản lý resource
  (owner/admin tổ chức sở hữu) gọi thẳng endpoint để tạo grant `ACTIVE` ngay, không có
  state chờ duyệt. Endpoint tạo (`POST /resources/{id}/access-requests`) đúng tên trong
  catalogue chính thức (§13.2); 2 endpoint list/revoke (`GET /resources/{id}/
  access-grants`, `POST /access-grants/{id}/revoke`) là **path tự đặt**, không có trong
  catalogue.
- **SUC-05 (Resource Search)**: có trong phạm vi bắt buộc chính thức (§12.3), nhưng cách
  làm kỹ thuật phải tự chọn — hiện chỉ làm full-text search (GIN index trên
  title/description) qua `GET /resources?q=`, **chưa làm vector/semantic search** vì
  Phase 2 không build pipeline embedding thật (xem mục dưới) nên chưa có dữ liệu vector
  để tìm. HNSW index cho `resource_chunk.embedding` cố tình để comment, không bật (đúng
  ghi chú của spec "tạo sau khi đủ dữ liệu và benchmark").
- **State machine `Resource`/`ResourceVersion`**: không nằm trong danh sách 10 state
  machine chính thức của spec — tự đề xuất transition (`Resource`: DRAFT→ACTIVE khi
  publish version đầu tiên, →ARCHIVED/WITHDRAWN; `ResourceVersion`: DRAFT→PUBLISHED/
  WITHDRAWN, PUBLISHED→SUPERSEDED/WITHDRAWN) bám theo đúng giá trị enum thật trong dbml.
- **Không có ingestion pipeline thật** (extract/chunk/embedding) — `POST /resources`/
  `POST .../versions` chỉ tạo `resource_ingestion_job` trạng thái `QUEUED`, không có
  worker nào xử lý tiếp. Để dành khi có quyết định chính thức về AI/embedding stack
  (liên quan Phase 5 — AI Recommendation).
- **Không scan malware thật** — chỉ validate MIME allowlist
  (`application/pdf`/`image/jpeg`/`image/png`) + giới hạn 20MB phía client trước khi
  cấp presigned upload URL. Không có thư viện scanning nào trong repo.

### Khi bắt đầu Phase 3

Theo đúng thứ tự trong `CLAUDE.md` — **không nhảy cóc module**: Phase 3 là Technology
Case & Evidence. Bảng `evidence`/`evidence_citation` (FK cứng tới `technology_case`) cố
tình chưa tạo ở Phase 2 vì phụ thuộc bảng Phase 3 chưa tồn tại — tạo mới ở migration
riêng của Phase 3, cùng cách xử lý additive đã dùng cho `verification_document`
(Phase 1→2). Trước khi code, đọc lại đúng thứ tự đã quy định ở rule 10 trong
`CLAUDE.md`: `01_workflow_theo_phase.md` (mục Phase 3) → `03_activity_diagrams.md` (mục
Phase 3) → `02_usecase_diagram.md` → đối chiếu `R2M_SPEC_DESIGN_V5_COMPLETE.md`.
