# R2M — Research-to-Market Platform

Tài liệu tổng hợp cho **Phase 1-3** (Identity & Organization, Verification, Resource
Catalog & Evidence, Technology Case). Đọc file này trước khi chạy hoặc mở rộng dự án. Với
business rule/spec gốc, xem `CLAUDE.md` và `docs/spec/`.

---

## 1. Tổng quan

R2M là nền tảng đăng ký, xác minh tổ chức/tác giả và quản lý tài nguyên nghiên cứu phục
vụ hoạt động chuyển giao công nghệ, kết nối 4 nhóm tổ chức: **đơn vị nghiên cứu**,
**doanh nghiệp**, **cơ quan nhà nước**, **tổ chức hỗ trợ**. Phase 1 xây phần nền: đăng ký
tổ chức, xác thực người dùng, xác minh tổ chức thủ công bởi platform reviewer. Phase 2
thêm: xác minh tác giả, đăng ký/versioning resource (paper/dataset/model/...), annotation,
cấp quyền truy cập resource, tìm kiếm full-text. Phase 3 thêm: Technology Case (aggregate
trung tâm — case + member + organization + lifecycle) và Evidence/Citation (liên kết
resource version làm bằng chứng cho case, bắt buộc có citation).

Toàn bộ hệ thống cuối cùng có 8 bounded context (xem `docs/spec/
R2M_V5_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md`). Đã triển khai 5 context: **Identity &
Organization**, **Verification** (tổ chức + tác giả), **Platform Operations**, **Resource
Catalog & Evidence** (bao gồm cả `citation`, dùng thật lần đầu ở Phase 3),
**Technology Case** (case core/member/organization/lifecycle + evidence — không gồm
Assessment/Gap/Roadmap, thuộc Phase 4).

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
├── resource-catalog/                      1 module duy nhất (resource/version/annotation/access-grant)
├── technology-case/                       1 module duy nhất (case/member/organization/evidence)
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
| `pnpm test:integration` | Integration test cho `apps/api` — NestJS DI container **thật** (`Test.createTestingModule`) + Postgres thật. Cần `docker compose up -d` + nạp `.env` trước. Xem §3.6. |
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

### 3.6 Integration test (`apps/api`)

Tách biệt hoàn toàn khỏi unit test (`pnpm test`, mock DI, chạy mọi máy không cần gì
thêm). Integration test boot **NestJS DI container thật** (`Test.createTestingModule({
imports: [AppModule] }).compile()`), gọi HTTP thật qua `supertest`, dùng Postgres thật —
đúng lớp test mà unit test `new Service(...)` thủ công không bao giờ chạm tới (xem README
§4 bug #5, #8).

```powershell
cd platform
docker compose -f infra/docker/docker-compose.yml up -d
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        Set-Item -Path "Env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
}
pnpm test:integration
```

- `apps/api/test/app-bootstrap.integration-spec.ts` — chỉ boot toàn bộ `AppModule` qua DI
  thật, assert `app.init()` không throw. Test giá trị cao nhất: tự động canh mọi module
  hiện có lẫn module mới thêm ở phase sau, không cần biết trước tên class nào.
- `apps/api/test/identity-organization.integration-spec.ts` — HTTP thật qua module từng
  bị bug #5: `GET /v1/me/profile` không token → 401, có token hợp lệ → 200;
  `POST /v1/organizations/register` → 201.
- Config riêng (`apps/api/vitest.integration.config.ts`, không đụng `vitest.config.ts`
  gốc) — dùng `unplugin-swc` thay vì esbuild mặc định của Vitest, **bắt buộc** vì NestJS
  DI thật cần decorator metadata mà esbuild không emit đúng (xem bug #8, cùng lớp với bug
  #3). File `*.integration-spec.ts` reset dữ liệu giữa các test bằng
  `resetDatabase()`/`createTestUser()` (`packages/testkit`).

---

## 4. Đã làm được (Phase 1-3)

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
  của spec, đã được review và duyệt ngày 2026-08-05 — xem §5), đặt trong
  `modules/resource-catalog/domain/` theo đúng ranh giới shared-
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
- 4 điểm **tự đề xuất business rule** (spec chỉ có 1 dòng mô tả hoặc hoàn toàn không đề
  cập) đã được user review và chốt ngày 2026-08-05 — chi tiết quyết định + lý do ở §5
  "Phase 2 — business rule đã chốt sau review".

### Phase 3

- **Domain & DB**: 8 bảng mới (`technology_case`, `case_origin`, `technology_profile`,
  `case_organization`, `case_member`, `case_status_history`, `evidence`,
  `evidence_citation`) khớp `docs/spec/schema_v5_production.dbml`. `case_origin` bỏ 3 cột
  FK tới bảng Phase 5 (`recommendation_item_id`/`research_proposal_id`/
  `case_initiation_request_id` — bảng chưa tồn tại), y hệt cách xử lý
  `resource_access_grant.source_transfer_manifest_id` ở Phase 2 — additive migration khi
  làm Phase 5. State machine `TechnologyCase` (10 trạng thái, **chính thức** trong §8, không
  tự đề xuất — khác Resource/ResourceVersion ở Phase 2) đặt ở
  `modules/technology-case/domain/`, khai báo đủ nhưng Phase 3 chỉ thực thi transition
  `DRAFT→EVIDENCE_COLLECTION`.
- **API**: tạo case thủ công (MANUAL origin, transaction đủ case + origin + profile +
  owning organization + OWNER member + status history), quản lý case member/organization
  (đúng 1 OWNER active, PARTNER_MEMBER phải thuộc org đã link PARTNER_COMPANY, member
  phải là active org member), transition lifecycle (giới hạn `EVIDENCE_COLLECTION` ở
  Phase 3), link evidence (citation bắt buộc, tự động transition case khi đây là evidence
  đầu tiên). Tái dùng `ResourcesService.assertVisible` (đổi `private`→public) để kiểm tra
  quyền đọc resource version trước khi cho evidence — cross-module reuse đúng tiền lệ
  `verification/` import `identity-organization/organizations`.
- **DB constraint mới**: lần đầu tiên dùng `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY
  DEFERRED` trong repo (`trg_evidence_requires_citation`) — kiểm tra evidence ACTIVE có
  ≥1 citation tại thời điểm COMMIT (không phải AFTER INSERT ngay, vì evidence và
  evidence_citation insert trong cùng transaction). Verify trực tiếp bằng `psql`: insert
  1 evidence ACTIVE không kèm citation trong transaction riêng → `COMMIT` bị chặn đúng
  bằng `CASE_EVIDENCE_REQUIRES_CITATION`, không để lại row mồ côi nào.
- Toàn bộ luồng verify **qua HTTP thật với Postgres thật** (kịch bản 10 bước: tạo case →
  chặn partner member chưa link org → link partner org → thêm partner member → chặn
  2 owner → link evidence (tự transition case) → chặn transition ngoài phạm vi Phase 3 →
  chặn VIEWER tạo evidence, xem `phase3-smoke.mjs`), cộng 16 unit test mock DI mới.
- **OpenAPI**: thêm 7 path (`technology-cases`, `technology-cases/{id}/{members,
  organizations,transitions,evidence}`) + 9 schema mới, mở rộng `Error.code`. Validate
  bằng script `js-yaml`: 191/191 `$ref` resolve đúng. Tiện sửa luôn 1 lỗi có sẵn từ
  Phase 2: endpoint search resource bị ghi nhầm tag "SUC-04" (đúng ra SUC-05).
- 2 điểm **tự đề xuất business rule** đã được user review và chốt ngày 2026-08-05 — chi
  tiết quyết định + lý do ở §5 "Phase 3 — business rule đã chốt sau review".

### Chuẩn bị Phase 4 — Integration test + CI

Hạ tầng test thuần tuý, không đụng business logic Phase 1-3. Xem §3.6 để chạy.

- **Integration test tách riêng unit test**: `apps/api/test/*.integration-spec.ts` (khác
  `*.spec.ts`), config Vitest riêng (`vitest.integration.config.ts`), script
  `pnpm test:integration` — không lẫn vào `pnpm test` (khác suffix file, khác config).
- **`app-bootstrap.integration-spec.ts`**: boot toàn bộ `AppModule` qua DI container thật.
- **`identity-organization.integration-spec.ts`**: HTTP thật qua `supertest` cho đúng
  module từng vỡ ở bug #5 — guard chặn/cho qua đúng, đăng ký tổ chức end-to-end.
- **CI** (`.github/workflows/ci.yml`, ở gốc git repo vì workspace pnpm nằm trong
  `platform/`): typecheck → lint → unit test → migrate → integration test → build, dùng
  đúng `infra/docker/docker-compose.yml` có sẵn (không định nghĩa lại service), dọn dẹp
  bằng `docker compose down -v` kể cả khi có bước fail.
- **Phát hiện 1 bug thật khi xây tầng này** — xem bug #8: Vitest (esbuild) không emit
  đúng decorator metadata cho NestJS DI thật, cùng lớp với bug #3. Sửa bằng
  `unplugin-swc`, chỉ áp dụng cho `vitest.integration.config.ts`.
- `turbo.json` cần khai báo `passThroughEnv` cho task `test:integration` — Turbo v2 mặc
  định sandbox biến môi trường của process con, không tự động truyền `DATABASE_URL`/
  `JWT_*`/`S3_*` dù đã có sẵn trong shell chạy lệnh.

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

**Phase 3 không phát sinh bug thật mới** — build/typecheck/lint/test đều sạch ngay từ
lần chạy đầu, và HTTP smoke test + verify constraint trigger trực tiếp qua `psql` cũng
pass ngay lần đầu. Khác biệt so với Phase 1-2 chủ yếu vì đã áp dụng đúng ngay từ đầu 2 bài
học đã ghi nhận trước đó: module tổng hợp phải `exports` (bug #5) và service không tự gọi
`loadEnv()` (bug #7) — không có nghĩa là code Phase 3 không cần kiểm tra kỹ, chỉ là lần
này không có phát hiện mới đáng ghi lại.

8. **Vitest (esbuild) không emit đúng decorator metadata cho NestJS DI thật — cùng lớp
   bug với bug #3** — khi thêm tầng integration test đầu tiên chạy qua DI container thật
   (`Test.createTestingModule({ imports: [AppModule] }).compile()`, chuẩn bị hạ tầng
   test trước Phase 4), `app.init()` pass bình thường (module graph resolve được), nhưng
   gọi HTTP thật qua `supertest` vào 1 route có `JwtAuthGuard` luôn trả **500**:
   `TypeError: Cannot read properties of undefined (reading 'getAllAndOverride')` tại
   `this.reflector.getAllAndOverride(...)` — `Reflector` (provider lõi của NestJS, không
   phải code tự viết) bị inject thành `undefined`. Nguyên nhân giống hệt bug #3: esbuild
   (transform mặc định của Vitest cho file `.ts`) không emit đúng `design:paramtypes` mà
   NestJS DI cần đọc lúc runtime — khác bug #3 ở chỗ lần này lộ ra qua 1 provider lõi
   (`Reflector`) thay vì service tự viết, và **chỉ lộ khi thực sự gọi HTTP qua guard**,
   không lộ lúc `app.init()` (module resolve không cần metadata runtime, guard hoạt động
   mới cần) — đúng lý do vì sao yêu cầu 3 (HTTP thật qua module từng vỡ) tồn tại độc lập
   với yêu cầu 2 (chỉ boot app), không cái nào thay thế được cái kia. Sửa: thêm
   `unplugin-swc` + `@swc/core`, chỉ áp dụng cho `apps/api/vitest.integration.config.ts`
   (bật `jsc.transform.legacyDecorator` + `jsc.transform.decoratorMetadata`) —
   **KHÔNG đổi** `vitest.config.ts` gốc (unit test dùng `new Service(...)` thủ công,
   không qua NestJS DI/reflection nên không cần), và **KHÔNG đổi** script
   `dev`/`build`/`start` của `apps/api` (vẫn `tsc` thật + `node dist/main.js` từ khi sửa
   bug #3, không liên quan tới transform của Vitest). Nếu sau này có ý định gộp lại dùng
   esbuild cho integration test để "cho gọn", đọc lại mục này trước — sẽ tái diễn đúng
   lỗi này, âm thầm và chỉ lộ qua HTTP thật, không lộ qua `app.init()`.

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
- **`apps/web` chưa có test nào** (không unit test component, không E2E). Có thể thêm
  Playwright cho luồng đăng ký/đăng nhập chính.
- **Không dùng Redis/BullMQ** dù đã có trong `docker-compose.yml` — `apps/worker` là
  poll loop đơn giản, đủ cho Phase 1-3 nhưng cần chuyển sang BullMQ khi có job cần
  backoff/retry thật (ingestion, embedding thật — Phase 2 chỉ tạo
  `resource_ingestion_job` ở trạng thái `QUEUED`, không có worker xử lý).
- **Chưa có ingestion pipeline thật** (extract/chunk/embedding) — `POST /resources`/
  `POST .../versions` chỉ tạo `resource_ingestion_job` trạng thái `QUEUED`, không có
  worker nào xử lý tiếp. Để dành khi có quyết định chính thức về AI/embedding stack
  (liên quan Phase 5 — AI Recommendation).
- **Không scan malware thật** — chỉ validate MIME allowlist
  (`application/pdf`/`image/jpeg`/`image/png`) + giới hạn 20MB phía client trước khi
  cấp presigned upload URL. Không có thư viện scanning nào trong repo.

### Phase 2 — business rule đã chốt sau review (2026-08-05)

4 điểm dưới đây từng đánh dấu `// ĐỀ XUẤT — CẦN REVIEW` trong code vì spec chỉ có 1 dòng
mô tả (không đủ 15 mục như UC chính) hoặc hoàn toàn không đề cập. User đã review và chốt
— code/comment/OpenAPI đã cập nhật để phản ánh đúng quyết định cuối, không còn đánh dấu
"cần review" nữa:

1. **SUC-04 (Resource Access Grant)** — xác nhận: "request" trong tên use case chỉ là
   hành động resource-manager cấp quyền trực tiếp, **không có state PENDING/entity
   request riêng**. Actor quản lý resource gọi thẳng endpoint để tạo
   `resource_access_grant` status `ACTIVE` ngay. Giữ nguyên implementation hiện tại,
   không đổi code.
2. **Đặt tên endpoint tự thêm** (không có trong catalogue §13.2) — chốt dùng
   `POST .../revoke` (khớp cách đặt tên action `submit`/`approve`/`publish` đã dùng ở
   các use case khác), áp dụng nhất quán cho mọi endpoint tự đặt về sau. Endpoint hiện
   tại (`POST /access-grants/{id}/revoke`) đã đúng convention này từ đầu.
3. **SUC-05 (Resource Search)** — xác nhận trì hoãn vector/semantic search tới khi có
   embedding stack thật (Phase 5), Phase 2 chỉ làm full-text search. Giữ nguyên
   implementation hiện tại.
4. **Cascade giữa `Resource` và `ResourceVersion`** — 2 quyết định tách biệt, không trộn
   chung 1 quy tắc:
   - `PUBLISHED → SUPERSEDED` (khi publish version mới hơn) **bắt buộc cascade**, để
     tránh 2 version cùng `PUBLISHED` song song khiến không nơi nào biết đâu là bản hiện
     hành khi resolve citation/evidence. Cascade đặt ở domain service
     (`resources.service.ts#publishVersion`), không đặt trong state machine — đã đúng vị
     trí từ khi implement, không đổi code.
   - `Resource` chuyển `ARCHIVED`/`WITHDRAWN` **không** cascade xuống `ResourceVersion` —
     đây là 2 khái niệm độc lập ("container còn hoạt động không" vs "bản nào là bản
     chính thức"). Version đã có citation/evidence trỏ vào (Phase 3) không được tự đổi
     trạng thái chỉ vì Resource cha bị archive, nếu không sẽ phá vỡ invariant "evidence
     active phải có citation hợp lệ". **Lưu ý**: endpoint archive/withdraw cho `Resource`
     **chưa tồn tại** ở Phase 2 (state machine đã khai báo transition
     `ACTIVE→ARCHIVED/WITHDRAWN` nhưng không nằm trong catalogue §13.2 gốc nên chưa có
     service/controller nào gọi tới) — quyết định "không cascade" này chỉ được **ghi
     nhận** để áp dụng đúng khi tính năng archive/withdraw thực sự được xây (thường đi
     cùng luồng quản lý resource ở phase sau), chưa cần code thêm ở Phase 2.

### Phase 3 — business rule đã chốt sau review (2026-08-05)

2 điểm dưới đây từng đánh dấu `// ĐỀ XUẤT — CẦN REVIEW` trong code vì spec mô tả không đủ
chi tiết hoặc có 2 nguồn hơi lệch nhau. User đã review và chốt — code/OpenAPI/
`docs/spec/01_workflow_theo_phase.md` §3.5-3.6 đã cập nhật để phản ánh đúng quyết định
cuối, không còn đánh dấu "cần review" nữa:

1. **Actor tạo Technology Case** (`technology-case.service.ts#register`) — xác nhận
   **AND**, giữ nguyên implementation: actor phải **vừa** là verified author **vừa**
   active member của `owningOrganizationId`. "Author VERIFIED / Organization ACTIVE" ở
   §3.4 `01_workflow_theo_phase.md` là cách viết tắt AND, không phải OR — đọc là OR sẽ
   tạo lỗ hổng bảo mật thật (bất kỳ verified author nào cũng tự khai owning organization
   là tổ chức họ không có quan hệ gì), vi phạm rule 4 CLAUDE.md (tenant scope bắt buộc ở
   application layer).
2. **Vai trò được phép link evidence** (`evidence.service.ts#create`) — **siết lại** so
   với đề xuất ban đầu: chỉ `OWNER`/`TECHNICAL_MEMBER`/`PARTNER_MEMBER`, **loại
   `CASE_REVIEWER`** khỏi danh sách (VIEWER vẫn bị chặn như cũ). Lý do: separation of
   duties — CASE_REVIEWER là người duyệt assessment/roadmap ở Phase 4 (§4.4) dựa trên
   evidence đã link ở Phase 3; nếu CASE_REVIEWER cũng tự link được evidence, họ có thể tự
   đưa bằng chứng vào rồi tự duyệt dựa trên chính bằng chứng đó, phá vỡ mục đích của bước
   review độc lập. Sai role trả mã lỗi mới `CASE_EVIDENCE_ROLE_NOT_ALLOWED` (tách khỏi
   `AUTH_FORBIDDEN` chung — dùng khi actor có membership nhưng role không đủ quyền, khác
   với không phải case member nào cả).

### Phạm vi cố tình chưa làm ở Phase 3

- **`POST /technology-cases/:id/transitions`** chỉ thực sự cho phép target
  `EVIDENCE_COLLECTION` — các bước sau (`UNDER_ASSESSMENT` trở đi) cần dữ liệu
  Assessment/Gap (Phase 4) chưa tồn tại để guard đúng (vd chặn `ROADMAP_APPROVED` khi còn
  gap CRITICAL). State machine đã khai báo đủ 10 trạng thái chính thức, chỉ chưa mở khoá
  guard cho các bước xa hơn.
- **Citation không dedupe** — mỗi lần link evidence luôn tạo `citation` mới, kể cả khi
  cùng `resource_version_id`/snippet đã có citation trước đó. Spec nói "tạo hoặc reuse"
  nhưng không định nghĩa tiêu chí trùng lặp.
- **`case_member` không có luồng invite/accept** — thêm thẳng status `ACTIVE`, khác
  `organization_member` (có `INVITED`→accept). Breakdown Phase 3 không yêu cầu bước này.
- **Endpoint archive/withdraw cho `Resource`** (gap đã ghi từ Phase 2) vẫn chưa xây —
  quyết định "không cascade xuống `ResourceVersion`" đã chốt, chỉ chưa có endpoint gọi
  tới.

### Khi bắt đầu Phase 4

Theo đúng thứ tự trong `CLAUDE.md` — **không nhảy cóc module**: Phase 4 là Assessment,
Gap, Roadmap. Case phải ở `EVIDENCE_COLLECTION` mới bắt đầu assessment được (đã sẵn sàng
từ Phase 3). Trước khi code, đọc lại đúng thứ tự đã quy định ở rule 10 trong
`CLAUDE.md`: `01_workflow_theo_phase.md` (mục Phase 4) → `03_activity_diagrams.md` (mục
Phase 4) → `02_usecase_diagram.md` → đối chiếu `R2M_SPEC_DESIGN_V5_COMPLETE.md`. Đặc
biệt chú ý invariant "client không quyết định composite score" (UC-ASM-01) và guard
"không approve roadmap khi còn CRITICAL gap mở".
