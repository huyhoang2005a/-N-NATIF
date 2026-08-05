# R2M — Research-to-Market Platform (V5)

Đây là file ngữ cảnh cho Claude Code. Đọc file này trước mọi task. Không tự suy
diễn schema/business rule — luôn tra `docs/spec/` trước khi viết code liên quan.

## Bản đồ tài liệu (đọc đúng phần, không đọc hết một lúc)

| Cần làm gì | Đọc file nào |
|---|---|
| Hiểu tổng quan kiến trúc, 8 bounded context, stack | `docs/spec/R2M_V5_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` §2–§8 |
| Viết/sửa 1 use case cụ thể | `docs/spec/R2M_SPEC_DESIGN_V5_COMPLETE.md` — tìm mã UC (vd `UC-CASE-01`) |
| Kiểm tra entity, quan hệ, cột, enum | `docs/spec/schema_v5_production.dbml` |
| Kiểm tra constraint/index/RLS production | `docs/spec/production_constraints_and_indexes.sql` |
| Xác nhận đủ coverage / invariant của 1 use case | `docs/spec/USE_CASE_COVERAGE_MATRIX.md` |
| So sánh với thiết kế cũ (nếu đụng code V4 cũ) | `docs/spec/V4_TO_V5_MIGRATION_PLAN.md` |
| Biết đang ở Phase nào, task nào tiếp theo | `R2M_V5_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` §14 Lộ trình triển khai |
| Biết chi tiết workflow của 1 Phase cụ thể (breakdown sprint, danh sách API/endpoint, business rule, error code, testing checklist, Definition of Done) | `docs/spec/01_workflow_theo_phase.md` — tìm đúng mục "Phase N" |
| Xem sơ đồ Use Case tổng thể hoặc theo từng bounded context (actor nào gọi UC nào, quan hệ include/extend) | `docs/spec/02_usecase_diagram.md` |
| Xem Activity Diagram (luồng nghiệp vụ từng bước, actor nào làm gì, decision point nào) của 1 Phase trước khi code | `docs/spec/03_activity_diagrams.md` — tìm đúng mục "Phase N" |

## Tech stack bắt buộc (không tự đổi)

- Monorepo: pnpm + Turborepo (`apps/web`, `apps/api`, `apps/worker`, `packages/*`)
- API: NestJS, modular monolith, 8 bounded context = 8 module độc lập
- DB: PostgreSQL 16+, Drizzle ORM + raw SQL migration (không dùng Prisma cho bản V5 này)
- Cache/Queue: Redis + BullMQ
- Object storage: S3-compatible, chỉ truy cập qua signed URL
- Web: Next.js App Router, Server Components mặc định
- API contract: OpenAPI 3.1

## Quy tắc bắt buộc — vi phạm là bug, không phải style

1. **Không tự suy ra business rule.** Mọi use case đều có "Business invariant" +
   "Acceptance criteria" trong spec — implement đúng theo đó, không tự thêm/bớt.
2. **State transition luôn qua domain service**, không update `status` trực tiếp
   từ controller/repository. Xem bảng state machine ở §8 spec chính.
3. **Mọi transition ghi kèm**: `*_status_history` (nếu có) + `audit_log` +
   `outbox_event` (nếu có tác động ngoài transaction).
4. **Tenant scope là bắt buộc ở tầng application**, không tin `organizationId`
   client gửi lên — luôn verify membership trước khi query. RLS chỉ là lớp
   phòng vệ thứ 2, không thay thế authorization ở code.
5. **Không tạo bảng "tổng hợp" kiểu `dashboard_data`.** Dashboard là read model
   — query tối ưu hoặc materialized view, cập nhật qua outbox event.
6. **Versioning**: sửa Resource/Annotation/RoadmapMilestone... không update đè —
   tạo version/revision mới theo đúng entity tương ứng trong dbml.
7. **Citation luôn trỏ tới `resource_version`**, không trỏ Resource trực tiếp.
   Evidence "active" bắt buộc có ít nhất 1 citation.
8. **Optimistic concurrency** (`version` hoặc `updated_at` compare) cho mọi
   aggregate nhiều người có thể sửa cùng lúc (assessment, roadmap, case).
9. **Error code ổn định** theo mẫu spec, ví dụ `CASE_INVALID_TRANSITION`,
   `ROADMAP_CRITICAL_GAP_OPEN` — không trả message tự do cho lỗi nghiệp vụ.
10. **Trước khi code 1 Phase**, đọc đúng 3 nguồn cho Phase đó theo thứ tự:
    mục "Phase N" trong `01_workflow_theo_phase.md` (breakdown sprint + API +
    invariant) → sơ đồ tương ứng trong `03_activity_diagrams.md` (luồng thực
    thi từng bước) → `02_usecase_diagram.md` nếu cần xem actor/quan hệ
    include-extend. Không tự chia nhỏ task khác đi với breakdown đã có sẵn
    trong `01_workflow_theo_phase.md`.

## Định nghĩa "xong" cho mỗi use case

Trước khi coi 1 use case là hoàn thành, đối chiếu đủ 3 việc:
- [ ] Domain service enforce đúng "Business invariant" trong spec
- [ ] Unit test cho luồng chính + luồng thay thế/ngoại lệ liệt kê trong spec
- [ ] Event/audit log được ghi đúng theo mục "API / Event / Audit" của use case đó

Với 1 **Phase** (không chỉ 1 use case đơn lẻ), đối chiếu thêm Definition of Done
của Phase đó ở cuối mục tương ứng trong `docs/spec/01_workflow_theo_phase.md`
trước khi coi Phase là hoàn thành.

## Thứ tự triển khai (theo Phase trong architecture plan)

Không nhảy cóc module — mỗi Phase phụ thuộc Phase trước. Chi tiết breakdown,
API endpoint, business rule, error code, testing checklist và DoD của từng
Phase nằm trong `docs/spec/01_workflow_theo_phase.md`; activity diagram tương
ứng nằm trong `docs/spec/03_activity_diagrams.md`.

0. Spec lock (đã xong — đây chính là bộ tài liệu này)
1. Platform foundation — Identity & Organization, Verification
2. Author & Resource — Resource Catalog & Evidence
3. Technology Case & Evidence
4. Assessment, Gap, Roadmap
5. Company & Discovery (bao gồm AI recommendation)
6. Transfer & Moderation
7. Production hardening

## Khi không chắc

Nếu 1 yêu cầu (từ tôi hoặc từ task) mâu thuẫn với spec trong `docs/spec/`,
**dừng lại và hỏi** thay vì tự quyết — spec là nguồn sự thật, không phải
suy luận của bạn tại thời điểm code.
## Cấu trúc thư mục dự án (tham khảo)

r2m-v5/
├── apps/
│   ├── web/                          # Next.js App Router
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   ├── organizations/
│   │   │   ├── cases/
│   │   │   ├── resources/
│   │   │   └── layout.tsx
│   │   ├── components/               # UI riêng của web, không share
│   │   ├── lib/                      # api client, auth helper
│   │   └── hooks/
│   │
│   ├── api/                          # NestJS modular monolith
│   │   └── src/
│   │       ├── modules/              # đúng 8 bounded context — không gộp/tách thêm
│   │       │   ├── identity-organization/
│   │       │   ├── verification/
│   │       │   ├── resource-catalog/
│   │       │   ├── technology-case/
│   │       │   ├── assessment-gap/
│   │       │   ├── roadmap-transfer/
│   │       │   ├── company-discovery/
│   │       │   └── platform-operations/
│   │       ├── common/                # guard, interceptor, filter dùng chung
│   │       ├── config/
│   │       └── main.ts
│   │
│   └── worker/                        # BullMQ processors — tách riêng khỏi api
│       └── src/processors/
│           ├── resource-ingestion.processor.ts
│           ├── embedding.processor.ts
│           ├── recommendation.processor.ts
│           ├── notification.processor.ts
│           └── transfer-expiration.processor.ts
│
├── packages/
│   ├── database/                      # Drizzle — nguồn sự thật duy nhất về schema
│   │   ├── schema/                    # chia file theo đúng 8 bounded context, khớp dbml
│   │   ├── migrations/                # raw SQL, đánh số thứ tự
│   │   └── seeds/
│   │
│   ├── contracts/                     # DTO/type dùng chung web ⇄ api ⇄ worker
│   │   ├── openapi/                   # OpenAPI 3.1 spec + generated client
│   │   └── events/                    # type cho outbox_event/domain event
│   │
│   ├── domain/                        # shared kernel: DomainError, ErrorCode,
│   │                                  #   StateMachine generic — KHÔNG chứa business
│   │                                  #   rule của 1 bounded context cụ thể (xem
│   │                                  #   packages/domain/README.md)
│   ├── env/                           # load biến môi trường .env runtime cho
│   │                                  #   api/worker/database (Zod-validate process.env)
│   ├── ui/                            # component dùng chung
│   ├── config/                        # eslint, tsconfig, tailwind base
│   └── utils/                         # helper thuần (date, money, error code map...)
│
├── docs/spec/                         # đã có sẵn — nguồn spec duy nhất, không đổi
│
├── infra/
│   ├── docker-compose.yml             # postgres, redis, minio (S3-compatible) local
│   └── docker/
│
├── .github/workflows/                 # CI: lint, test, build, migration check
├── CLAUDE.md
├── turbo.json
├── pnpm-workspace.yaml
└── package.json

### Nguyên tắc bắt buộc theo cấu trúc trên

- `apps/api/src/modules/` phải khớp chính xác 8 bounded context trong architecture
  plan. Hai module không import chéo trực tiếp — giao tiếp qua event (outbox) hoặc
  qua `packages/contracts`.
- `packages/database/schema/` chia theo đúng 8 bounded context, tên file khớp
  `schema_v5_production.dbml` — tra 1 entity chỉ đọc đúng 1 file, không load cả schema.
- `packages/contracts/` là nơi DUY NHẤT định nghĩa DTO/type dùng chung — không tự
  đoán lại shape response giữa `web` và `api`.
- Domain service nằm trong `apps/api/src/modules/<context>/domain/` — không đặt
  business logic ở controller hay repository (khớp Quy tắc 2 ở trên).
- `apps/worker` chạy tách process khỏi `apps/api`, dù cùng đọc `packages/database`.
- Mỗi bounded context ở `apps/api/src/modules/<context>/` có thể chứa nhiều NestJS
  module con, nhưng luôn có 1 module tổng hợp `<context>.module.ts` để `app.module.ts`
  chỉ import đúng số bounded context đang tồn tại — không import lẻ module con.
- Logic dùng chung nhiều bounded context nằm ở `packages/domain` (shared kernel).
  Logic đặc thù 1 bounded context nằm ở `modules/<context>/domain/`.