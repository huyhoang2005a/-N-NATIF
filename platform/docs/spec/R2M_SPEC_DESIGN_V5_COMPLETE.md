# RESEARCH-TO-MARKET PLATFORM
## SPEC DESIGN V5 — IMPLEMENTATION BASELINE

**Phiên bản:** 5.0  
**Ngày ban hành:** 31/07/2026  
**Trạng thái:** Baseline sẵn sàng triển khai  
**Ngôn ngữ:** Tiếng Việt  
**Kiến trúc:** Modular Monolith, Event-enabled  
**Schema chuẩn:** `schema_v5_production.dbml`  
**Ràng buộc production:** `production_constraints_and_indexes.sql`

> Tài liệu này là nguồn đặc tả chức năng và kỹ thuật chính thức cho việc tiếp tục thiết kế, tạo backlog, sinh API contract và bắt đầu vibe coding. Schema DBML và SQL đi kèm là tài liệu chuẩn tắc; khi có xung đột, business invariant trong tài liệu này và constraint trong SQL phải được ưu tiên, sau đó cập nhật lại các artefact còn lại để đồng bộ.

## MỤC LỤC

| Chương | Nội dung |
| --- | --- |
| 0 | Kiểm soát tài liệu |
| 1 | Tóm tắt điều hành |
| 2 | Bối cảnh, vấn đề và mục tiêu |
| 3 | Phạm vi phát hành |
| 4 | Stakeholder, actor và trách nhiệm |
| 5 | Thuật ngữ miền nghiệp vụ |
| 6 | Kiến trúc hệ thống |
| 7 | Mô hình quyền và tenant |
| 8 | State machine chính thức |
| 9 | Đặc tả module |
| 10 | Use case nghiệp vụ chi tiết |
| 11 | Use case bổ trợ bắt buộc |
| 12 | Mô hình dữ liệu chuẩn |
| 13 | API contract |
| 14 | Event, outbox và background job |
| 15 | Thiết kế AI Recommendation và Retrieval |
| 16 | Security, privacy và compliance-oriented controls |
| 17 | Yêu cầu phi chức năng |
| 18 | Observability và vận hành |
| 19 | Testing strategy |
| 20 | CI/CD, môi trường và migration |
| 21 | Roadmap triển khai |
| 22 | Definition of Ready và Definition of Done |
| 23 | Risk register |
| 24 | Ma trận truy vết yêu cầu |
| 25 | Phụ lục chuẩn tắc |
| 26 | Kết luận baseline |

## 0. Kiểm soát tài liệu

| Thuộc tính | Giá trị |
| --- | --- |
| Tên hệ thống | Research-to-Market Platform (R2M) |
| Mục tiêu | Quản lý hành trình từ kết quả nghiên cứu tới đánh giá, hoàn thiện, pilot, chuyển giao và thương mại hóa |
| Đối tượng sử dụng | Đơn vị nghiên cứu, tác giả, doanh nghiệp, chuyên gia đánh giá và quản trị nền tảng |
| Phạm vi V5 | Multi-tenant, resource versioning, evidence/citation, discovery, assessment, gap, roadmap, transfer, moderation, audit |
| Không thuộc phạm vi V5 | Thanh toán, ký hợp đồng pháp lý điện tử, định giá tài sản trí tuệ tự động, quản lý ERP/CRM đầy đủ |
| Mức chuẩn bị | Production-oriented design; chỉ production-ready sau khi code, migration, test, vận hành và security review đạt |

### 0.1 Lịch sử phiên bản

| Phiên bản | Nội dung chính | Trạng thái |
| --- | --- | --- |
| V1–V4 | Spec nghiệp vụ ban đầu và schema tiến hóa theo từng vòng đánh giá | Tham khảo |
| V5.0 | Chuẩn hóa bounded context, quyền ba tầng, 59 entity, traceability và production controls | Baseline |

### 0.2 Quy ước từ khóa

- **MUST / BẮT BUỘC:** điều kiện phải được thực thi; vi phạm phải làm transaction thất bại hoặc bị chặn ở policy layer.
- **SHOULD / NÊN:** mặc định phải thực hiện, chỉ được bỏ khi có ADR ghi rõ lý do.
- **MAY / CÓ THỂ:** tùy chọn triển khai.
- **Aggregate:** cụm dữ liệu có một root kiểm soát invariant và transaction boundary.
- **Tenant context:** tổ chức hiện hành mà người dùng đang thao tác.
- **Resource Version:** phiên bản bất biến của tài nguyên; citation luôn trỏ tới một version cụ thể.

## 1. Tóm tắt điều hành

R2M là nền tảng quản lý quá trình biến một kết quả nghiên cứu thành một hồ sơ công nghệ có thể được doanh nghiệp đánh giá, phối hợp hoàn thiện và tiếp nhận. Nền tảng không chỉ là kho lưu tài liệu. Nguồn sự thật trung tâm là **Technology Case**, liên kết con người, tổ chức, resource, evidence, assessment, gap, roadmap và transfer manifest trong một chuỗi truy vết được.

Luồng giá trị chính:

```text
Organization + User
        ↓
Author / Organization Verification
        ↓
Resource + Immutable Resource Version
        ↓
Research Need / Proposal / AI Recommendation
        ↓
Technology Case
        ↓
Evidence + Citation
        ↓
Readiness Assessment
        ↓
Gap Analysis
        ↓
Commercialization Roadmap
        ↓
Transfer Manifest + Access Grant
        ↓
Pilot / Commercialization
```

AI đóng vai trò **hỗ trợ discovery và phân tích**, không có quyền tự tạo quan hệ hợp tác, tự phê duyệt assessment, tự kết luận transfer thành công hoặc vượt qua quyền truy cập. Mọi kết luận quan trọng phải có người chịu trách nhiệm và citation truy ngược tới resource version.

## 2. Bối cảnh, vấn đề và mục tiêu

### 2.1 Vấn đề cần giải quyết

Kết quả nghiên cứu thường phân tán giữa paper, source code, dataset, checkpoint, báo cáo thử nghiệm và tài liệu nội bộ. Doanh nghiệp khó trả lời các câu hỏi: công nghệ đã sẵn sàng đến đâu, bằng chứng nào hỗ trợ kết luận, thiếu gì để triển khai, ai chịu trách nhiệm, rủi ro dữ liệu/bản quyền nằm ở đâu và gói chuyển giao gồm những gì. Tác giả cũng thiếu một quy trình có cấu trúc để trình bày công nghệ theo nhu cầu thị trường.

### 2.2 Mục tiêu sản phẩm

| ID | Mục tiêu | Thước đo chấp nhận |
| --- | --- | --- |
| G-01 | Tạo hồ sơ công nghệ có vòng đời rõ ràng | 100% Technology Case có owner, owning organization và status history |
| G-02 | Đảm bảo mọi đánh giá quan trọng có thể kiểm chứng | Mỗi score/evidence/recommendation active có citation hợp lệ tới resource version |
| G-03 | Kết nối nhu cầu doanh nghiệp với nghiên cứu phù hợp | Research Need có proposal/recommendation được quản lý theo version và quyền |
| G-04 | Chuyển gap thành kế hoạch hành động | Roadmap liên kết milestone/task với gap; không approve khi còn critical gap mở |
| G-05 | Chuyển giao có kiểm soát | Transfer Manifest có item, recipient, permission, expiry và revoke |
| G-06 | Bảo vệ dữ liệu multi-tenant | Không có truy cập chéo organization/case trong integration và security test |

### 2.3 Mục tiêu kỹ thuật

- Một codebase modular monolith dễ phát triển bằng AI coding agent nhưng có ranh giới domain rõ.
- API contract ổn định, có idempotency, audit và optimistic concurrency cho write quan trọng.
- PostgreSQL là nguồn sự thật giao dịch; JSONB chỉ dùng cho metadata linh hoạt, không thay thế quan hệ cốt lõi.
- Event outbox bảo đảm notification, ingestion và AI jobs không bị mất khi transaction thành công.
- Có thể bật Row-Level Security như lớp phòng vệ thứ hai sau khi policy test hoàn chỉnh.

### 2.4 Ngoài phạm vi

- Thực hiện giao dịch tài chính, escrow hoặc thanh toán phí chuyển giao.
- Sinh hoặc ký hợp đồng pháp lý có hiệu lực thay luật sư.
- Tự động cấp bằng sáng chế, xác nhận license hợp pháp hoặc định giá sở hữu trí tuệ.
- Lưu bản sao mọi tài liệu gốc bắt buộc; hệ thống hỗ trợ external location và object storage có kiểm soát.
- Thay thế Git hosting, data lake, MLOps platform hoặc document management system chuyên dụng.

## 3. Phạm vi phát hành

### 3.1 MVP bắt buộc

1. Identity, organization, membership và verification.
2. Resource catalog, immutable version, paper metadata, annotation và citation.
3. Technology Case, member, partner organization, evidence và lifecycle.
4. Assessment framework, score, evidence/citation và gap.
5. Roadmap, milestone, task, dependency, review và approval.
6. Company profile, research need, proposal và recommendation run có citation.
7. Transfer manifest, recipient và resource access grant.
8. Notification, moderation, audit, outbox và idempotency.
9. Dashboard theo role/tenant dưới dạng read model.

### 3.2 Sau MVP

- Semantic search nâng cao, hybrid ranking và recommendation learning-to-rank.
- Tích hợp ORCID, GitHub, DOI/Crossref, data repositories và enterprise SSO.
- Contract workflow, e-signature, IP/legal review, cost estimation và portfolio analytics.
- Public marketplace, licensing catalogue và partner CRM.

## 4. Stakeholder, actor và trách nhiệm

| Actor | Phạm vi | Trách nhiệm |
| --- | --- | --- |
| Guest | Chưa đăng nhập | Đăng ký tài khoản/tổ chức, xem nội dung public |
| User | Đã xác thực | Quản lý profile, notification và tenant context |
| Author | Có AuthorProfile | Đăng ký resource, annotation, proposal, case và evidence; thao tác nhạy cảm yêu cầu VERIFIED |
| Company Member | Thuộc enterprise organization | Quản lý company profile, research need, proposal và recommendation |
| Organization Owner/Admin | Vai trò trong organization | Mời thành viên, quản lý profile tổ chức và quyền nội bộ |
| Case Owner | Vai trò trong Technology Case | Quản lý case, thành viên, assessment, roadmap và transfer |
| Technical Member | Vai trò trong Technology Case | Cập nhật evidence, gap, task và nội dung kỹ thuật |
| Case Reviewer | Vai trò trong Technology Case | Đánh giá readiness, gap và roadmap review |
| Platform Reviewer | Vai trò cấp nền tảng | Duyệt verification và xử lý content flag |
| Platform Admin | Vai trò cấp nền tảng | Quản trị chính sách, reviewer, suspension và vận hành |
| AI/Worker | Actor hệ thống | Ingestion, embedding, recommendation, notification; không vượt quyền người dùng khởi tạo |

## 5. Thuật ngữ miền nghiệp vụ

| Thuật ngữ | Định nghĩa chuẩn |
| --- | --- |
| Organization | Tenant nghiệp vụ: đơn vị nghiên cứu, doanh nghiệp, cơ quan nhà nước hoặc tổ chức hỗ trợ. |
| Author Profile | Hồ sơ vai trò tác giả; tách khỏi user account và có vòng đời xác minh riêng. |
| Resource | Tài nguyên nghiên cứu cấp logic: paper, dataset, model, source code, patent, report… |
| Resource Version | Ảnh chụp bất biến của resource tại một thời điểm; là đích bắt buộc của citation. |
| Citation | Bộ định vị tới resource version: page, section, chunk, offset, URL fragment và snippet. |
| Annotation | Lớp chú thích của tác giả trên resource version; sửa bằng annotation revision. |
| Research Need | Nhu cầu nghiên cứu của doanh nghiệp; nội dung chi tiết được version hóa. |
| Recommendation Run | Một lần chạy AI với model/prompt/config cụ thể, sinh nhiều recommendation item. |
| Technology Case | Workspace quản lý một công nghệ từ draft tới commercialization. |
| Evidence | Tuyên bố một resource/citation hỗ trợ Technology Case hoặc kết luận cụ thể. |
| Assessment Framework | Bộ rubric có version gồm các criterion và thang điểm. |
| Gap | Khoảng trống cần xử lý, có severity, owner, status và bằng chứng. |
| Roadmap | Kế hoạch thương mại hóa có version, milestone, task, dependency và review. |
| Transfer Manifest | Danh mục tài nguyên/version được chia sẻ; không phải bản sao file gốc. |
| Access Grant | Quyền truy cập có permission, người nhận, thời hạn và khả năng revoke. |
| Outbox Event | Event được ghi cùng transaction để worker phát đi đáng tin cậy. |

## 6. Kiến trúc hệ thống

### 6.1 Quyết định kiến trúc

**Modular monolith trong monorepo**, có worker riêng nhưng dùng chung domain contracts và database. Không tách microservice trong MVP.

```text
[Browser]
   ↓ HTTPS
[Next.js Web]
   ↓ REST/OpenAPI
[NestJS API — Modular Monolith]
   ├── Identity & Organization
   ├── Verification
   ├── Resource Catalog & Evidence
   ├── Company & Discovery
   ├── Technology Case
   ├── Assessment & Gap
   ├── Roadmap & Transfer
   └── Platform Operations
   ↓                    ↘
[PostgreSQL]          [Redis/BullMQ]
   ↓                    ↓
[Outbox]             [NestJS Worker]
                         ├── ingestion/chunking
                         ├── embeddings/recommendation
                         └── notification delivery

[S3-compatible Object Storage] ← signed URL, private verification/resource files
```

### 6.2 Stack chính thức

| Lớp | Công nghệ baseline | Quyết định |
| --- | --- | --- |
| Monorepo | pnpm + Turborepo | Một workspace, shared types/config, build cache |
| Web | Next.js App Router + TypeScript | Server Components mặc định; client component khi có tương tác |
| API | NestJS + TypeScript | REST, OpenAPI, module/domain/application/infrastructure |
| Worker | NestJS standalone + BullMQ | Async jobs và outbox consumers |
| Database | PostgreSQL 16+ | Nguồn sự thật giao dịch |
| ORM/Migration | Drizzle ORM + SQL migration | Giữ khả năng kiểm soát partial index, trigger, RLS, pgvector |
| Cache/Queue | Redis + BullMQ | Cache có tenant key; retry/backoff/dead-letter |
| Object storage | S3-compatible | Private bucket; signed URL; malware scan |
| Search | PostgreSQL FTS + pgvector | Hybrid retrieval; vector optional ở phase đầu |
| API contract | OpenAPI 3.1 | Sinh client SDK và contract test |
| Observability | OpenTelemetry + structured logs | Trace ID xuyên web/API/worker |
| Deployment | Container-based | Dev/staging/prod tách biệt; managed DB/Redis/storage |

### 6.3 Cấu trúc repository

```text
apps/
  web/
  api/
  worker/
packages/
  db/                 # Drizzle schema, migrations, seeds
  contracts/          # DTO, OpenAPI helpers, event schemas
  domain/             # value objects, enums, pure policies
  authz/              # permission checks and scopes
  observability/
  config/
infra/
  docker/
  terraform-or-platform-config/
docs/
  spec/
  adr/
  openapi/
```

### 6.4 Tám bounded context

| Bounded context | Aggregate root | Trách nhiệm |
| --- | --- | --- |
| Identity & Organization | UserAccount, Organization, OrganizationMember | Danh tính, tenant, membership, platform role |
| Verification | OrganizationVerificationRequest, AuthorVerificationRequest | Duyệt tổ chức/tác giả và tài liệu private |
| Resource Catalog & Evidence | Resource, ResourceVersion, Citation, Annotation, Evidence | Versioning, ingestion, citation, quyền truy cập |
| Company & Discovery | ResearchNeed, ResearchProposal, RecommendationRun | Nhu cầu, proposal, AI matching có citation |
| Technology Case | TechnologyCase, TechnologyProfile | Lifecycle, member, partner organization, origin |
| Assessment & Gap | AssessmentFramework, ReadinessAssessment, GapRecord | Rubric, score, evidence/citation, gap resolution |
| Roadmap & Transfer | Roadmap, TransferManifest | Milestone/task/dependency, approval, transfer/access |
| Platform Operations | ContentFlag, Notification, AuditLog, OutboxEvent | Moderation, notification, audit, reliability |

## 7. Mô hình quyền và tenant

### 7.1 Ba tầng quyền

1. **Platform role:** `USER`, `PLATFORM_REVIEWER`, `PLATFORM_ADMIN`.
2. **Organization membership:** `ORG_OWNER`, `ORG_ADMIN`, `MEMBER`.
3. **Technology Case membership:** `OWNER`, `TECHNICAL_MEMBER`, `CASE_REVIEWER`, `PARTNER_MEMBER`, `VIEWER`.

Role không được suy diễn chéo tầng. Platform reviewer không tự động được xem resource private hoặc sửa Technology Case. Author/Company là capability/profile và membership, không phải platform role.

### 7.2 Permission matrix cốt lõi

| Hành động | Ai được phép | Điều kiện |
| --- | --- | --- |
| Quản lý organization profile | ORG_OWNER/ORG_ADMIN | Organization hiện hành ACTIVE |
| Mời hoặc đình chỉ member | ORG_OWNER/ORG_ADMIN | Không được loại active owner cuối cùng |
| Nộp author verification | Author | Chính chủ; chưa VERIFIED; không có request pending |
| Duyệt verification | PLATFORM_REVIEWER/ADMIN | Reviewer khác applicant; audit bắt buộc |
| Đăng ký resource | VERIFIED Author hoặc org member được cấp quyền | Owner organization hiện hành |
| Xem resource private | Owner org/case member/access grant | Grant còn hiệu lực và permission phù hợp |
| Tạo Technology Case | VERIFIED Author | Organization ACTIVE |
| Quản lý case member | Case OWNER | Tuân thủ membership và partner rules |
| Chấm assessment | OWNER/TECHNICAL_MEMBER/CASE_REVIEWER theo policy | Case cho phép và framework active |
| Approve roadmap | OWNER hoặc reviewer được policy cho phép | Không có critical gap mở; review hợp lệ |
| Share transfer | Case OWNER | Roadmap approved; item/recipient/access hợp lệ |
| Moderate content | PLATFORM_REVIEWER/ADMIN | Không phải owner nội dung; decision + audit |

### 7.3 Quy tắc tenant bắt buộc

- Mọi request nghiệp vụ MUST có `actorUserId` và tenant/case context rõ ràng.
- Query không được nhận `organizationId` từ client rồi tin trực tiếp; server phải xác minh membership.
- Repository/query service phải áp scope organization/case trước khi filter khác.
- Cache key MUST chứa tenant context và permission-sensitive version.
- Signed URL chỉ sinh sau authorization check, có TTL ngắn và không log URL đầy đủ.
- RLS được dùng defense-in-depth, không thay application authorization.

## 8. State machine chính thức

| Đối tượng | Chuyển trạng thái hợp lệ |
| --- | --- |
| Organization | PENDING_VERIFICATION → ACTIVE / REJECTED; ACTIVE → SUSPENDED / ARCHIVED; SUSPENDED → ACTIVE / ARCHIVED |
| AuthorProfile | UNVERIFIED → PENDING → VERIFIED / DECLINED; VERIFIED → SUSPENDED; DECLINED → PENDING |
| ResearchNeed | DRAFT → OPEN → PAUSED / CLOSED; PAUSED → OPEN / CLOSED; any non-archived → ARCHIVED |
| ResearchProposal | DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED / REJECTED; SUBMITTED/UNDER_REVIEW → WITHDRAWN |
| CaseInitiationRequest | PENDING → ACCEPTED / DECLINED / CANCELLED / EXPIRED |
| TechnologyCase | DRAFT → EVIDENCE_COLLECTION → UNDER_ASSESSMENT → GAP_IDENTIFIED → ROADMAP_DRAFT → ROADMAP_APPROVED → PILOT_READY → TRANSFER_READY → COMMERCIALIZED → ARCHIVED |
| Assessment | DRAFT → SUBMITTED → APPROVED / CHANGES_REQUESTED; CHANGES_REQUESTED → DRAFT |
| Gap | OPEN → IN_PROGRESS → RESOLVED; OPEN/IN_PROGRESS → ACCEPTED_RISK; resolved có thể REOPENED theo policy |
| Roadmap | DRAFT → IN_REVIEW → APPROVED / CHANGES_REQUESTED; APPROVED → SUPERSEDED / ARCHIVED |
| TransferManifest | DRAFT → READY → SHARED → REVOKED / EXPIRED; DRAFT/READY → CANCELLED |

### 8.1 Quy tắc transition

- State transition phải đi qua domain service; cấm cập nhật status trực tiếp từ controller.
- Mỗi transition ghi `case_status_history` hoặc history tương ứng, `audit_log` và outbox event nếu có tác động ngoài transaction.
- Dùng optimistic concurrency (`version` hoặc `updated_at` compare) cho aggregate có nhiều người sửa.
- Transition thất bại trả error code ổn định, ví dụ `CASE_INVALID_TRANSITION`, `ROADMAP_CRITICAL_GAP_OPEN`.

## 9. Đặc tả module

### 9.1 Identity & Organization

- Quản lý user account, identity provider, profile, organization, domain và membership.
- Một user có thể thuộc nhiều organization; chỉ một tenant context active trong mỗi request.
- Mỗi organization có đúng một active ORG_OWNER.
- Email thay đổi phải qua identity verification riêng; không sửa trực tiếp email đã xác minh.

### 9.2 Verification

- Tài liệu xác minh lưu private, truy cập qua signed URL có TTL và audit.
- Organization verification và Author verification là hai workflow riêng.
- Reviewer không được duyệt request của chính mình hoặc nơi có conflict of interest được cấu hình.
- Decision bắt buộc có reason khi reject; approval cập nhật profile trong cùng transaction.

### 9.3 Resource Catalog & Evidence

- Resource là identity logic; ResourceVersion bất biến.
- Paper chỉ là metadata mở rộng của Resource type PAPER.
- Annotation revision độc lập với resource version; sửa annotation không tạo paper version giả.
- Citation luôn trỏ tới resource version; evidence active có ít nhất một citation.

### 9.4 Company & Discovery

- Research Need có statement version để proposal và recommendation bám đúng nội dung.
- AI run ghi model, prompt template version, parameters và input snapshot/hash.
- Recommendation item có score, rationale và citation; không có citation thì không được active.
- Tạo case từ recommendation luôn yêu cầu Author consent.

### 9.5 Technology Case

- Case có owning organization, partner organizations và members riêng.
- Case origin lưu manual/proposal/recommendation/import và reference nguồn.
- TechnologyProfile chứa mô tả công nghệ chuẩn hóa, không thay thế Resource.
- Mỗi case có đúng một active OWNER và lịch sử status đầy đủ.

### 9.6 Assessment & Gap

- Framework/criterion có version và immutable sau khi được dùng.
- Mỗi score có rationale và liên kết evidence/citation.
- Composite score được tính server-side theo weight; client không gửi kết quả cuối làm nguồn sự thật.
- Gap liên kết assessment finding và có severity/status/owner/resolution.

### 9.7 Roadmap & Transfer

- Roadmap có root/version, không chỉ milestone rời rạc.
- Dependency là quan hệ chuẩn hóa và phải chống cycle.
- Approve roadmap bị chặn khi critical gap chưa resolved/accepted risk.
- Transfer manifest chỉ chứa item/version/location/access; không nhân bản file gốc.

### 9.8 Platform Operations

- Content flag target rõ ràng, moderation decision bất biến và audit.
- Notification được sinh qua outbox; hỗ trợ dedupe.
- Audit log append-only; không chứa secret hoặc signed URL đầy đủ.
- Idempotency key bảo vệ command tạo/sửa quan trọng khỏi gửi lặp.

## 10. Use case nghiệp vụ chi tiết

### UC-ORG-01 — Đăng ký tổ chức

| Trường | Đặc tả |
| --- | --- |
| Actor | Guest (chính); Platform Reviewer (phụ đối với doanh nghiệp) |
| Trigger | Guest chọn tạo tài khoản tổ chức. |
| Tiền điều kiện | Chưa có phiên đăng nhập hợp lệ.<br>Email và domain chưa bị blocklist. |
| Đầu vào | Tên tổ chức, loại tổ chức, website, mã định danh/tax code, email tổ chức, mật khẩu hoặc OAuth identity. |

#### Luồng chính

1. Validate email/domain, tên/slug và mã định danh.
2. Tạo `user_account`, `user_identity`, `user_profile`.
3. Tạo `organization` ở `PENDING_VERIFICATION`.
4. Tạo `organization_domain` và `organization_member` role `ORG_OWNER`.
5. Tạo `organization_verification_request` nếu không thỏa auto-verification policy.
6. Ghi audit/outbox; gửi email xác minh và notification.

#### Luồng thay thế và ngoại lệ

- Tên/slug/domain trùng: trả `ORG_ALREADY_EXISTS`.
- Domain public/blacklisted: từ chối hoặc yêu cầu manual review.
- Request gửi lặp với cùng idempotency key: trả lại kết quả cũ.

#### Hậu điều kiện

- Tổ chức và owner được tạo atomically.
- Tổ chức chỉ ACTIVE sau verification policy.

#### Business invariant

- Đúng một active ORG_OWNER.
- Organization name/slug chuẩn hóa và unique theo policy.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/organizations/register`<br>`POST /v1/organizations/{id}/verification-requests` |
| Domain event | `OrganizationRegistered`<br>`OrganizationVerificationRequested` |
| Audit | Actor, IP, user-agent, organizationId, quyết định auto/manual; không log password/token. |

#### Acceptance criteria

- Given dữ liệu hợp lệ, when đăng ký, then user + org + owner membership được commit cùng nhau.
- Given domain không hợp lệ, then không có bản ghi dở dang.
- Given request lặp cùng idempotency key, then không tạo organization thứ hai.

### UC-VER-01 — Nộp hồ sơ xác minh tác giả

| Trường | Đặc tả |
| --- | --- |
| Actor | Author |
| Trigger | Author chọn “Xác minh danh tính”. |
| Tiền điều kiện | User authenticated.<br>AuthorProfile tồn tại và status UNVERIFIED/DECLINED.<br>Không có request PENDING/IN_REVIEW. |
| Đầu vào | Institution, ORCID tùy chọn, loại tài liệu, file PDF/JPG/PNG, ghi chú. |

#### Luồng chính

1. Xin presigned upload URL sau authorization.
2. Client upload file vào private quarantine bucket.
3. Worker scan MIME/size/malware.
4. Tạo `author_verification_request` PENDING và `verification_document`.
5. Cập nhật AuthorProfile PENDING.
6. Gửi notification cho reviewer qua outbox.

#### Luồng thay thế và ngoại lệ

- File không hợp lệ/malware: xóa quarantine object và từ chối.
- Đã VERIFIED: trả `AUTHOR_ALREADY_VERIFIED`.
- Đã có request mở: trả request hiện tại.

#### Hậu điều kiện

- Request có document hợp lệ, profile PENDING.

#### Business invariant

- Document chỉ thuộc một verification request.
- Private object key không công khai.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/author-verifications/uploads`<br>`POST /v1/author-verifications` |
| Domain event | `AuthorVerificationSubmitted` |
| Audit | Ghi loại tài liệu và object key hash; không ghi nội dung tài liệu. |

#### Acceptance criteria

- Request chỉ được tạo sau scan thành công.
- Không thể tạo hai request active cho cùng author.
- Reviewer nhận notification sau commit.

### UC-VER-02 — Duyệt xác minh tác giả

| Trường | Đặc tả |
| --- | --- |
| Actor | Platform Reviewer/Platform Admin |
| Trigger | Reviewer mở request PENDING/IN_REVIEW. |
| Tiền điều kiện | Reviewer authenticated và có platform role phù hợp.<br>Reviewer khác applicant. |
| Đầu vào | Decision APPROVE/REJECT, reason, review notes. |

#### Luồng chính

1. Lock request bằng optimistic concurrency.
2. Chuyển PENDING → IN_REVIEW khi reviewer nhận xử lý.
3. Kiểm tra tài liệu qua signed URL có TTL.
4. Nếu approve: request APPROVED và AuthorProfile VERIFIED trong cùng transaction.
5. Nếu reject: request REJECTED, AuthorProfile DECLINED, reason bắt buộc.
6. Ghi moderation-style audit, outbox và notification cho author.

#### Luồng thay thế và ngoại lệ

- Request đã được reviewer khác xử lý: trả conflict.
- Tài liệu hỏng/không truy cập: chuyển trạng thái cần bổ sung hoặc reject theo policy.

#### Hậu điều kiện

- Request và AuthorProfile đồng bộ.

#### Business invariant

- Không tự duyệt.
- Mọi decision có reviewerId, timestamp; reject có reason.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `GET /v1/platform/author-verifications`<br>`POST /v1/platform/author-verifications/{id}/claim`<br>`POST /v1/platform/author-verifications/{id}/decision` |
| Domain event | `AuthorVerified`<br>`AuthorVerificationRejected` |
| Audit | Decision, reviewer, reason, request version và correlation ID. |

#### Acceptance criteria

- Approve cập nhật hai bảng atomically.
- Concurrent decision chỉ có một request thành công.
- Author nhận notification chính xác.

### UC-CMP-01 — Tạo hồ sơ doanh nghiệp

| Trường | Đặc tả |
| --- | --- |
| Actor | Enterprise Organization Owner/Admin |
| Trigger | Thành viên doanh nghiệp mở thiết lập company profile. |
| Tiền điều kiện | Organization type ENTERPRISE và status ACTIVE.<br>Actor là ORG_OWNER/ORG_ADMIN. |
| Đầu vào | Tên hiển thị, ngành, quy mô, website, mô tả năng lực, contact person, vùng hoạt động. |

#### Luồng chính

1. Validate organization và quyền.
2. Validate unique company profile cho organization.
3. Tạo `company_profile`.
4. Ghi audit và event.

#### Luồng thay thế và ngoại lệ

- Organization chưa ACTIVE/SUSPENDED: chặn.
- Profile đã tồn tại: chuyển sang update flow.

#### Hậu điều kiện

- CompanyProfile ACTIVE và gắn đúng organization.

#### Business invariant

- Một company profile chính cho mỗi enterprise organization.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/company-profiles`<br>`PATCH /v1/company-profiles/{id}` |
| Domain event | `CompanyProfileCreated`<br>`CompanyProfileUpdated` |
| Audit | Các trường thay đổi và actor. |

#### Acceptance criteria

- Research need chỉ tạo được sau khi company profile tồn tại.
- User ngoài organization không xem dữ liệu private.

### UC-DIS-01 — Định nghĩa nhu cầu nghiên cứu

| Trường | Đặc tả |
| --- | --- |
| Actor | Company Member được cấp quyền |
| Trigger | Company tạo hoặc sửa Research Need. |
| Tiền điều kiện | CompanyProfile tồn tại.<br>Actor thuộc enterprise organization và có quyền. |
| Đầu vào | Title, problem statement, technical fields, desired output, constraints, timeframe, budget range tùy chọn, visibility. |

#### Luồng chính

1. Tạo `research_need` DRAFT.
2. Tạo `need_statement_version` version 1 với snapshot nội dung.
3. Validate mức độ cụ thể theo rule và optional AI assistant.
4. Khi publish, chuyển status OPEN và đóng băng current statement version.
5. Ghi audit/outbox; có thể enqueue recommendation run.

#### Luồng thay thế và ngoại lệ

- Statement quá rộng: trả validation suggestions, không tự sửa nguồn sự thật.
- Update published need: tạo statement version mới thay vì overwrite.

#### Hậu điều kiện

- Need có current version và status phù hợp.

#### Business invariant

- Proposal/recommendation phải tham chiếu đúng statement version.
- PRIVATE/ORG_ONLY không xuất hiện trong public browse.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/research-needs`<br>`POST /v1/research-needs/{id}/versions`<br>`POST /v1/research-needs/{id}/publish` |
| Domain event | `ResearchNeedCreated`<br>`ResearchNeedPublished`<br>`ResearchNeedVersioned` |
| Audit | Version hash, visibility, actor. |

#### Acceptance criteria

- Update nội dung tạo version mới.
- Public listing chỉ trả OPEN + PUBLIC.
- Publish bị chặn khi thiếu trường bắt buộc.

### UC-DIS-02 — Gửi đề xuất nghiên cứu

| Trường | Đặc tả |
| --- | --- |
| Actor | Verified Author; Company Reviewer |
| Trigger | Author chọn một public Research Need và gửi proposal. |
| Tiền điều kiện | Author VERIFIED.<br>ResearchNeed OPEN và PUBLIC. |
| Đầu vào | Title, abstract, methodology, deliverables, estimated timeline, linked resources. |

#### Luồng chính

1. Load current need statement version.
2. Validate author, visibility và deadline.
3. Tạo `research_proposal` SUBMITTED tham chiếu statement version.
4. Gửi notification cho company.
5. Company chuyển UNDER_REVIEW rồi ACCEPTED/REJECTED bằng command riêng.
6. Nếu accepted, có thể tạo case initiation flow hoặc Technology Case theo transaction được xác nhận.

#### Luồng thay thế và ngoại lệ

- Need đóng trước submit: chặn.
- Author rút proposal trước final decision: WITHDRAWN.
- Trùng proposal theo policy: cảnh báo hoặc chặn.

#### Hậu điều kiện

- Proposal lưu immutable submission snapshot.

#### Business invariant

- Không đổi statement version của proposal sau submit.
- Accepted proposal chỉ tạo tối đa một case origin active.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/research-needs/{id}/proposals`<br>`POST /v1/proposals/{id}/submit`<br>`POST /v1/proposals/{id}/decision` |
| Domain event | `ProposalSubmitted`<br>`ProposalAccepted`<br>`ProposalRejected` |
| Audit | Actor, need version, linked resources, decision reason. |

#### Acceptance criteria

- Verified author gửi thành công và company được thông báo.
- Need đóng thì transaction không tạo proposal.
- Accept tạo origin link không trùng.

### UC-DIS-03 — Xem đề xuất AI

| Trường | Đặc tả |
| --- | --- |
| Actor | Company Member |
| Trigger | Company yêu cầu recommendation cho Research Need. |
| Tiền điều kiện | ResearchNeed có statement version hợp lệ.<br>Actor có quyền xem need. |
| Đầu vào | Need version, filters, topK; model/prompt config do server policy kiểm soát. |

#### Luồng chính

1. Tạo `recommendation_run` QUEUED với input hash.
2. Worker retrieval theo tenant/access, sau đó ranking và generation.
3. Tạo `recommendation_item` với resource/version, score và rationale.
4. Tạo `recommendation_citation` tới citation đã validate.
5. Chỉ chuyển run COMPLETED khi mọi active item có citation.
6. API trả feed có score, rationale, source và locator.

#### Luồng thay thế và ngoại lệ

- Không có kết quả: run COMPLETED với zero item và explanation.
- Model/worker lỗi: FAILED, retry theo policy.
- Resource bị revoke trong lúc chạy: bỏ item hoặc đánh dấu stale.

#### Hậu điều kiện

- Kết quả truy vết được tới model/prompt/input/resource version.

#### Business invariant

- AI không truy cập resource ngoài quyền của actor/tenant.
- Active item phải có ít nhất một citation.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/research-needs/{id}/recommendation-runs`<br>`GET /v1/recommendation-runs/{id}`<br>`GET /v1/recommendation-runs/{id}/items` |
| Domain event | `RecommendationRunQueued`<br>`RecommendationRunCompleted`<br>`RecommendationRunFailed` |
| Audit | Model, prompt template version, input hash, resource IDs; không log nội dung private quá mức. |

#### Acceptance criteria

- Mỗi item hiển thị citation mở được khi actor có quyền.
- Run không COMPLETE nếu item active thiếu citation.
- Rerun không ghi đè run cũ.

### UC-DIS-04 — Khởi tạo Technology Case từ recommendation

| Trường | Đặc tả |
| --- | --- |
| Actor | Company Member; Verified Author |
| Trigger | Company chọn recommendation item và gửi lời mời. |
| Tiền điều kiện | Recommendation item ACTIVE.<br>Target author VERIFIED và có liên hệ với resource/công nghệ theo policy. |
| Đầu vào | Recommendation item, message, proposed partner organization, requested owner. |

#### Luồng chính

1. Tạo `case_initiation_request` PENDING, giữ recommendation item reference.
2. Thông báo target author.
3. Author xem citation và chấp nhận/từ chối.
4. Khi accept, một transaction tạo TechnologyCase DRAFT, CaseOrigin, owning org, partner org, owner member, status history, technology profile draft và evidence/citation seed nếu được xác nhận.
5. Request chuyển ACCEPTED và liên kết case.

#### Luồng thay thế và ngoại lệ

- Author decline/cancel/expire: không tạo case.
- Item stale/removed: yêu cầu company chọn lại.
- Concurrent accept: idempotency bảo đảm một case.

#### Hậu điều kiện

- Case giữ đầy đủ provenance tới recommendation.

#### Business invariant

- Author consent bắt buộc.
- Mỗi accepted request có tối đa một Technology Case.
- Case có đúng một owner.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/recommendation-items/{id}/case-initiation-requests`<br>`POST /v1/case-initiation-requests/{id}/accept`<br>`POST /v1/case-initiation-requests/{id}/decline` |
| Domain event | `CaseInitiationRequested`<br>`TechnologyCaseCreated` |
| Audit | Company, author, recommendation run/item, consent timestamp. |

#### Acceptance criteria

- Decline không tạo dữ liệu case.
- Accept tạo toàn bộ aggregate atomically.
- Citation provenance vẫn truy được từ case.

### UC-RES-01 — Đăng ký Resource

| Trường | Đặc tả |
| --- | --- |
| Actor | Verified Author/Authorized Organization Member |
| Trigger | Người dùng chọn “Add Resource”. |
| Tiền điều kiện | Organization ACTIVE.<br>Actor có capability phù hợp. |
| Đầu vào | Type, title, description, external URL hoặc upload, access level, metadata; PAPER có DOI/authors/publication fields. |

#### Luồng chính

1. Validate access policy, URL/file và duplicate hints.
2. Tạo `resource` DRAFT và `resource_version` version 1.
3. Nếu PAPER, tạo `paper_metadata`.
4. Nếu có file/nội dung có thể xử lý, tạo `resource_ingestion_job` QUEUED.
5. Publish version sau validation; cập nhật resource ACTIVE nếu policy cho phép.
6. Ghi audit/event.

#### Luồng thay thế và ngoại lệ

- Duplicate DOI/hash: cảnh báo và yêu cầu merge/link.
- URL inaccessible: cho lưu DRAFT nhưng không publish.
- File scan fail: quarantine và FAILED.

#### Hậu điều kiện

- Resource có ít nhất một version.

#### Business invariant

- Published resource version bất biến.
- Mọi resource có owner organization và access level.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/resources`<br>`POST /v1/resources/{id}/versions`<br>`POST /v1/resource-versions/{id}/publish` |
| Domain event | `ResourceRegistered`<br>`ResourceVersionPublished`<br>`ResourceIngestionQueued` |
| Audit | Metadata, access level, source location hash. |

#### Acceptance criteria

- Không tạo resource không có version.
- Sửa nội dung published tạo version mới.
- Paper metadata chỉ áp dụng type PAPER.

### UC-RES-02 — Quản lý annotation của tác giả

| Trường | Đặc tả |
| --- | --- |
| Actor | Verified Author/Resource Manager |
| Trigger | Actor thêm hoặc sửa annotation trên resource version. |
| Tiền điều kiện | Có quyền MANAGE resource.<br>ResourceVersion tồn tại và không bị withdrawn. |
| Đầu vào | Target locator, annotation content, tags, visibility. |

#### Luồng chính

1. Validate locator nằm trong resource version.
2. Tạo `annotation` cho lần đầu.
3. Tạo `annotation_revision` version 1 hoặc revision mới khi sửa.
4. Không sửa row revision cũ.
5. Ghi audit và event.

#### Luồng thay thế và ngoại lệ

- Locator không hợp lệ: chặn.
- Resource version superseded: cho annotation lịch sử nhưng cảnh báo và có thể clone sang version mới.

#### Hậu điều kiện

- Annotation có revision mới và current revision pointer theo implementation.

#### Business invariant

- Content không rỗng.
- Sửa annotation không tạo ResourceVersion mới.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/resource-versions/{id}/annotations`<br>`POST /v1/annotations/{id}/revisions`<br>`DELETE /v1/annotations/{id}` |
| Domain event | `AnnotationCreated`<br>`AnnotationRevised`<br>`AnnotationRemoved` |
| Audit | Old/new revision IDs và actor. |

#### Acceptance criteria

- Revision cũ vẫn đọc được.
- Unauthorized actor không sửa được.
- Locator luôn gắn một resource version cụ thể.

### UC-CASE-01 — Tạo Technology Case thủ công

| Trường | Đặc tả |
| --- | --- |
| Actor | Verified Author |
| Trigger | Author chọn “Create Technology Case”. |
| Tiền điều kiện | Author VERIFIED.<br>Owning organization ACTIVE. |
| Đầu vào | Title, summary, technology type, owner organization, optional initial resources. |

#### Luồng chính

1. Validate author và membership.
2. Tạo `technology_case` DRAFT.
3. Tạo `case_origin` MANUAL.
4. Tạo `case_organization` OWNING_ORGANIZATION.
5. Tạo `case_member` OWNER cho author.
6. Tạo `technology_profile` draft và `case_status_history`.
7. Ghi audit/outbox.

#### Luồng thay thế và ngoại lệ

- Author không VERIFIED: hướng tới verification.
- Organization không ACTIVE: chặn.
- Idempotent retry: trả case cũ.

#### Hậu điều kiện

- Case có owner, org, origin, profile, history đầy đủ.

#### Business invariant

- Một active owner.
- Owner thuộc owning organization.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/technology-cases`<br>`GET /v1/technology-cases/{id}`<br>`POST /v1/technology-cases/{id}/members` |
| Domain event | `TechnologyCaseCreated` |
| Audit | Origin, owner, organization, request ID. |

#### Acceptance criteria

- Không có case “mồ côi”.
- Case DRAFT chỉ hiện trong scope cho phép.
- Owner assignment atomically.

### UC-EVD-01 — Liên kết Resource làm Evidence

| Trường | Đặc tả |
| --- | --- |
| Actor | Case Owner/Technical Member |
| Trigger | Actor chọn “Add Evidence” trong case. |
| Tiền điều kiện | Actor có quyền case.<br>Có quyền VIEW resource/version. |
| Đầu vào | Resource version, claim/description, annotation optional reference, citation locator/snippet. |

#### Luồng chính

1. Authorize cả case và resource.
2. Validate citation locator/snippet.
3. Tạo hoặc reuse `citation`.
4. Tạo `evidence` DRAFT/ACTIVE theo policy.
5. Tạo `evidence_citation`; annotation mô tả ý nghĩa là bắt buộc dưới dạng claim/rationale hoặc annotation reference.
6. Nếu access cần chia sẻ cho case, tạo grant theo approval policy.
7. Ghi audit/event.

#### Luồng thay thế và ngoại lệ

- Không có quyền: chặn và không tiết lộ metadata nhạy cảm.
- Citation invalid: chặn activation.
- Resource withdrawn: evidence chuyển stale/review required.

#### Hậu điều kiện

- Evidence active truy ngược tới resource version/citation.

#### Business invariant

- Active evidence có ít nhất một citation.
- Không copy nội dung nguồn vượt quá snippet policy.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/technology-cases/{id}/evidence`<br>`POST /v1/evidence/{id}/citations`<br>`DELETE /v1/evidence/{id}` |
| Domain event | `EvidenceLinked`<br>`EvidenceDeprecated` |
| Audit | Case, resource version, citation, access decision. |

#### Acceptance criteria

- Citation bắt buộc trước ACTIVE.
- Cross-tenant resource chỉ dùng khi grant hợp lệ.
- Xóa logic giữ audit/history.

### UC-ASM-01 — Thực hiện Readiness Assessment

| Trường | Đặc tả |
| --- | --- |
| Actor | Case Reviewer/Owner/Technical Member theo policy |
| Trigger | Actor mở assessment cho Technology Case. |
| Tiền điều kiện | Case tối thiểu UNDER_ASSESSMENT hoặc transition được phép.<br>Assessment framework active. |
| Đầu vào | Framework version, score theo criterion, rationale, linked evidence/citations. |

#### Luồng chính

1. Tạo `readiness_assessment` DRAFT khóa framework version.
2. Tạo/cập nhật `assessment_score` cho từng criterion.
3. Validate score range và criterion thuộc framework.
4. Liên kết evidence/citation cho mỗi score bắt buộc.
5. Tính weighted composite score server-side.
6. Submit assessment; validate completeness.
7. Reviewer/owner approve hoặc request changes theo policy.

#### Luồng thay thế và ngoại lệ

- Thiếu citation/evidence: không submit.
- Framework mới phát hành: assessment cũ vẫn bám version cũ; tạo assessment mới nếu cần.
- Concurrent edit: optimistic concurrency conflict.

#### Hậu điều kiện

- Assessment submitted/approved có traceability đầy đủ.

#### Business invariant

- Client không quyết định composite score.
- Score nằm trong min/max.
- Approved assessment bất biến, sửa bằng revision/new assessment.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/technology-cases/{id}/assessments`<br>`PUT /v1/assessments/{id}/scores/{criterionId}`<br>`POST /v1/assessments/{id}/submit`<br>`POST /v1/assessments/{id}/decision` |
| Domain event | `AssessmentCreated`<br>`AssessmentSubmitted`<br>`AssessmentApproved` |
| Audit | Framework version, score change, evidence/citation links, reviewer. |

#### Acceptance criteria

- Submit bị chặn nếu criterion bắt buộc thiếu chứng cứ.
- Composite score tái tính nhất quán.
- Approved record không bị overwrite.

### UC-GAP-01 — Thực hiện Gap Analysis

| Trường | Đặc tả |
| --- | --- |
| Actor | Case Reviewer/Owner/Technical Member |
| Trigger | Từ assessment hoặc evidence, actor tạo gap. |
| Tiền điều kiện | Case có assessment/evidence phù hợp. |
| Đầu vào | Title, description, category, severity, owner, target date, linked assessment finding/evidence/citation. |

#### Luồng chính

1. Tạo `gap_record` OPEN.
2. Liên kết `gap_evidence` và `gap_citation`.
3. Validate severity và support.
4. Assign owner và optional due date.
5. Cho phép transition IN_PROGRESS/RESOLVED/ACCEPTED_RISK với resolution note.
6. Ghi audit/event.

#### Luồng thay thế và ngoại lệ

- Thiếu severity/support: chặn.
- Accept risk yêu cầu role và reason cao hơn.
- Reopen resolved gap tạo history qua audit/event.

#### Hậu điều kiện

- Gap có owner/status và nguồn chứng minh.

#### Business invariant

- Critical gap không thể bị bỏ qua khi approve roadmap trừ ACCEPTED_RISK hợp lệ.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/technology-cases/{id}/gaps`<br>`PATCH /v1/gaps/{id}`<br>`POST /v1/gaps/{id}/transition` |
| Domain event | `GapCreated`<br>`GapStatusChanged`<br>`CriticalGapRaised` |
| Audit | Severity/status/owner cũ-mới, reason. |

#### Acceptance criteria

- Gap thiếu severity không được lưu.
- Resolved yêu cầu resolution note.
- Roadmap rule nhìn đúng trạng thái gap.

### UC-RDM-01 — Xây dựng Commercialization Roadmap

| Trường | Đặc tả |
| --- | --- |
| Actor | Case Owner/Technical Member; Case Reviewer |
| Trigger | Case đã có gap analysis. |
| Tiền điều kiện | Case status GAP_IDENTIFIED/ROADMAP_DRAFT. |
| Đầu vào | Roadmap version, milestones, tasks, owners, dates, dependencies, linked gaps, review decision. |

#### Luồng chính

1. Tạo `roadmap` DRAFT version 1.
2. Thêm milestone/task và liên kết gap.
3. Tạo dependency edge sau kiểm tra cùng roadmap và không cycle.
4. Validate dates, owner và completion criteria.
5. Submit IN_REVIEW.
6. Reviewer ghi `roadmap_review`.
7. Approve chỉ khi không còn CRITICAL gap OPEN/IN_PROGRESS.
8. Chuyển case ROADMAP_APPROVED trong cùng transaction nếu policy yêu cầu.

#### Luồng thay thế và ngoại lệ

- Cycle: từ chối edge với path gây vòng.
- Critical gap còn mở: trả danh sách blocker.
- Sửa roadmap đã approved: tạo version mới/supersede, không overwrite.

#### Hậu điều kiện

- Roadmap approved có review, version và links đầy đủ.

#### Business invariant

- Dependency không tự trỏ/cycle.
- Approved roadmap immutable.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/technology-cases/{id}/roadmaps`<br>`POST /v1/roadmaps/{id}/milestones`<br>`POST /v1/roadmaps/{id}/dependencies`<br>`POST /v1/roadmaps/{id}/submit`<br>`POST /v1/roadmaps/{id}/reviews` |
| Domain event | `RoadmapCreated`<br>`RoadmapSubmitted`<br>`RoadmapApproved` |
| Audit | Version, blockers, reviewer, dependency changes. |

#### Acceptance criteria

- Cycle bị chặn.
- Critical gap mở chặn approve.
- Approved update tạo version mới.

### UC-TRF-01 — Chuẩn bị và chia sẻ Transfer Package

| Trường | Đặc tả |
| --- | --- |
| Actor | Case Owner |
| Trigger | Owner tạo transfer manifest sau roadmap approval. |
| Tiền điều kiện | Roadmap APPROVED.<br>Case có thể chuyển TRANSFER_READY theo policy. |
| Đầu vào | Resource versions, recipient users/orgs, permissions, expiration, notes. |

#### Luồng chính

1. Tạo `transfer_manifest` DRAFT.
2. Thêm `transfer_manifest_item` trỏ đúng resource version/location.
3. Thêm `transfer_recipient`.
4. Validate owner có quyền chia sẻ và recipient được phép.
5. Tạo `resource_access_grant` với VIEW/DOWNLOAD, expiry.
6. Chuyển READY rồi SHARED; phát notification.
7. Cho phép revoke/expire, cập nhật grant atomically.

#### Luồng thay thế và ngoại lệ

- Restricted resource: yêu cầu approval hoặc loại khỏi manifest.
- Không có item/recipient: không READY/SHARED.
- Recipient organization suspended: chặn hoặc revoke.

#### Hậu điều kiện

- Manifest và grant có thể kiểm tra/revoke.

#### Business invariant

- Không chứa file binary trong manifest.
- Grant có đúng một recipient target và expiry/revoke status.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/technology-cases/{id}/transfer-manifests`<br>`POST /v1/transfer-manifests/{id}/items`<br>`POST /v1/transfer-manifests/{id}/recipients`<br>`POST /v1/transfer-manifests/{id}/share`<br>`POST /v1/transfer-manifests/{id}/revoke` |
| Domain event | `TransferManifestCreated`<br>`TransferManifestShared`<br>`TransferAccessRevoked` |
| Audit | Ai chia sẻ gì, version nào, cho ai, permission, expiry. |

#### Acceptance criteria

- Share bị chặn nếu thiếu item/recipient.
- Revoke làm grant mất hiệu lực ngay.
- Recipient chỉ thấy item được grant.

### UC-MOD-01 — Xử lý nội dung bị gắn cờ

| Trường | Đặc tả |
| --- | --- |
| Actor | Platform Reviewer/Platform Admin |
| Trigger | ContentFlag PENDING được mở xử lý. |
| Tiền điều kiện | Reviewer có role và không conflict. |
| Đầu vào | Target, reason category, evidence, decision KEEP/HIDE/REMOVE/RESTRICT_AUTHOR/DISMISS, notes. |

#### Luồng chính

1. Khi flag đủ điều kiện, có thể chuyển target HIDDEN tạm thời theo policy.
2. Reviewer claim case và điều tra.
3. Tạo `moderation_decision` bất biến.
4. Cập nhật `content_flag` CLOSED/DISMISSED và target moderation status.
5. Nếu restrict author/org, tạo action theo policy riêng.
6. Gửi notification cho reporter và owner; ghi audit.

#### Luồng thay thế và ngoại lệ

- Flag vô căn cứ: DISMISS và khôi phục target.
- Target đã bị xóa: đóng flag với reference lịch sử.
- Concurrent decision: một reviewer thắng optimistic lock.

#### Hậu điều kiện

- Decision và trạng thái target nhất quán.

#### Business invariant

- Đúng một target hợp lệ.
- Decision bắt buộc reviewer, reason, timestamp.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `POST /v1/content-flags`<br>`GET /v1/platform/content-flags`<br>`POST /v1/platform/content-flags/{id}/claim`<br>`POST /v1/platform/content-flags/{id}/decision` |
| Domain event | `ContentFlagCreated`<br>`ModerationDecisionRecorded` |
| Audit | Target, reporter, reviewer, decision, before/after state. |

#### Acceptance criteria

- Owner/reporter nhận notification.
- Content hidden trong review nếu policy yêu cầu.
- Không xóa audit khi target removed.

### UC-SYS-01 — Quản lý notification

| Trường | Đặc tả |
| --- | --- |
| Actor | Authenticated User |
| Trigger | User mở notification center hoặc đánh dấu trạng thái. |
| Tiền điều kiện | Authenticated. |
| Đầu vào | Filters, cursor, notification IDs. |

#### Luồng chính

1. List notification theo recipient và tenant-safe metadata.
2. Mark READ/DISMISSED theo batch.
3. Link điều hướng chỉ trả khi user còn quyền đối tượng.
4. Delivery worker gửi email/in-app theo preference và dedupe key.

#### Luồng thay thế và ngoại lệ

- Target không còn quyền: notification vẫn có lịch sử nhưng link bị ẩn.
- Delivery lỗi: retry/backoff/dead-letter; in-app không mất.

#### Hậu điều kiện

- Status notification cập nhật cho chính user.

#### Business invariant

- Không đọc/sửa notification của người khác.
- Dedupe theo event + recipient + template.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `GET /v1/notifications`<br>`POST /v1/notifications/read`<br>`POST /v1/notifications/dismiss` |
| Domain event | `NotificationRead`<br>`NotificationDismissed` |
| Audit | Không cần log từng read trừ policy; log admin delivery operations. |

#### Acceptance criteria

- Batch update chỉ ảnh hưởng notification của actor.
- Pagination ổn định.
- Retry không gửi trùng ngoài policy.

### UC-SYS-02 — Cập nhật hồ sơ cá nhân

| Trường | Đặc tả |
| --- | --- |
| Actor | Authenticated User |
| Trigger | User lưu profile. |
| Tiền điều kiện | Authenticated. |
| Đầu vào | Display name, avatar, phone, title, locale, timezone, contact preferences. |

#### Luồng chính

1. Validate field và ownership.
2. Patch `user_profile` bằng field allowlist.
3. Avatar qua signed upload + scan.
4. Nếu yêu cầu đổi email, tạo identity verification flow riêng, không sửa email primary ngay.
5. Ghi audit và event.

#### Luồng thay thế và ngoại lệ

- Input invalid: trả field errors.
- Avatar scan fail: giữ avatar cũ.

#### Hậu điều kiện

- Profile cập nhật; email chỉ đổi sau verification.

#### Business invariant

- Không cho client sửa platform role/status.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `GET /v1/me/profile`<br>`PATCH /v1/me/profile`<br>`POST /v1/me/email-change` |
| Domain event | `UserProfileUpdated`<br>`EmailChangeRequested` |
| Audit | Changed field names, không log PII không cần thiết. |

#### Acceptance criteria

- Mass assignment bị chặn.
- Email không đổi trực tiếp.
- Profile cache invalidated.

### UC-SYS-03 — Xem dashboard cá nhân hóa

| Trường | Đặc tả |
| --- | --- |
| Actor | Authenticated User |
| Trigger | Sau login hoặc mở dashboard. |
| Tiền điều kiện | Có tenant context hợp lệ hoặc user chọn organization. |
| Đầu vào | Tenant context, date range, optional widget filters. |

#### Luồng chính

1. Resolve platform/org/case scope.
2. Query read model: active cases, pending actions, proposals, verifications, gaps, roadmap, notifications.
3. Áp cache key chứa user + tenant + permission version.
4. Trả widget phù hợp role; không dùng bảng DashboardData làm nguồn sự thật.

#### Luồng thay thế và ngoại lệ

- Một widget lỗi: trả partial response với error per widget.
- Cache miss: query projection/materialized view.
- User nhiều org chưa chọn tenant: trả organization selector.

#### Hậu điều kiện

- Không thay đổi domain data ngoài telemetry.

#### Business invariant

- Không lộ dữ liệu tenant khác.
- Stale cache tối đa theo SLO và invalidated bằng event.

#### API / Event / Audit

| Loại | Nội dung |
| --- | --- |
| API | `GET /v1/dashboard`<br>`GET /v1/dashboard/widgets/{key}` |
| Domain event | `Không bắt buộc; có telemetry DashboardViewed` |
| Audit | Chỉ log access bất thường hoặc admin dashboard; metrics không chứa PII. |

#### Acceptance criteria

- Response p95 đạt SLO.
- Widget theo role đúng.
- Cross-tenant test không trả dữ liệu.

## 11. Use case bổ trợ bắt buộc để backend hoàn chỉnh

| ID | Use case | Yêu cầu chính |
| --- | --- | --- |
| SUC-01 | Đăng nhập/đăng xuất/refresh/revoke session | OIDC/local identity, MFA cho platform role, session/device management |
| SUC-02 | Mời và quản lý Organization Member | Invite token, accept, role change, suspend/leave, transfer owner |
| SUC-03 | Duyệt Organization Verification | Manual review, domain/tax validation, activate/reject/suspend |
| SUC-04 | Quản lý Resource Access Grant | Request/approve/revoke/expire VIEW/DOWNLOAD/MANAGE |
| SUC-05 | Tìm kiếm Resource Catalog | FTS + vector, permission filtering trước ranking |
| SUC-06 | Quản lý Case Organization/Member | Add partner/reviewer org, invite member, role change, remove |
| SUC-07 | Chuyển Technology Case lifecycle | Policy-based transition + history + blockers |
| SUC-08 | Review Proposal | Claim, comment, accept/reject, create case origin |
| SUC-09 | Quản lý Assessment Framework | Platform admin version/activate/deprecate rubric |
| SUC-10 | Quản lý Roadmap Version | Clone approved roadmap, supersede, compare versions |
| SUC-11 | Export Audit/Case Summary | Permissioned export; watermark/redaction; async job |
| SUC-12 | Quản lý dữ liệu cá nhân | Export/delete request, retention, legal hold theo policy |

## 12. Mô hình dữ liệu chuẩn

### 12.1 Nguyên tắc

- Primary key UUID; timestamp UTC `timestamptz`; soft-delete chỉ khi có lý do nghiệp vụ.
- `created_at`, `updated_at`, `created_by`/`updated_by` ở aggregate quan trọng.
- Published/versioned records bất biến; thay đổi bằng version/revision mới.
- Foreign key bắt buộc cho quan hệ cốt lõi; JSONB chỉ cho metadata/provider payload không dùng để join/constraint.
- Unique/partial index bảo vệ “một active owner”, “một current version”, “một active request”.
- Check/trigger bảo vệ range, recipient exclusivity, dependency cycle và approval blockers.

### Identity & Organization

| Entity | Mục đích |
| --- | --- |
| user_account | Trạng thái tài khoản và platform role. |
| user_identity | Identity provider, subject, verified email. |
| user_profile | Thông tin hiển thị và preference. |
| organization | Tenant và trạng thái tổ chức. |
| organization_domain | Domain xác minh/allowlist. |
| organization_verification_request | Workflow duyệt tổ chức. |
| organization_member | Membership và org role. |

### Verification

| Entity | Mục đích |
| --- | --- |
| author_profile | Hồ sơ tác giả và verification status. |
| author_verification_request | Request/decision xác minh. |
| verification_document | Tài liệu private của request. |

### Company & Discovery

| Entity | Mục đích |
| --- | --- |
| company_profile | Hồ sơ doanh nghiệp. |
| research_need | Root nhu cầu. |
| need_statement_version | Snapshot version nội dung need. |
| research_proposal | Proposal bám need version. |
| recommendation_run | Một lần chạy AI. |
| recommendation_item | Kết quả xếp hạng. |
| recommendation_citation | Citation của item. |
| case_initiation_request | Consent trước tạo case. |

### Resource & Evidence

| Entity | Mục đích |
| --- | --- |
| resource | Identity logic của tài nguyên. |
| resource_version | Phiên bản bất biến. |
| paper_metadata | Metadata mở rộng cho paper. |
| resource_ingestion_job | Trạng thái pipeline. |
| resource_chunk | Chunk/search/vector. |
| citation | Locator tới resource version. |
| annotation | Root annotation. |
| annotation_revision | Lịch sử nội dung annotation. |
| evidence | Bằng chứng của case. |
| evidence_citation | N-N evidence/citation. |
| resource_access_grant | Quyền truy cập có hạn. |

### Technology Case

| Entity | Mục đích |
| --- | --- |
| technology_case | Aggregate root/lifecycle. |
| case_origin | Nguồn tạo case. |
| technology_profile | Hồ sơ công nghệ chuẩn hóa. |
| case_organization | Vai trò organization trong case. |
| case_member | Vai trò user trong case. |
| case_status_history | Lịch sử transition. |

### Assessment & Gap

| Entity | Mục đích |
| --- | --- |
| assessment_framework | Rubric version. |
| assessment_criterion | Tiêu chí/thang điểm/weight. |
| readiness_assessment | Assessment instance. |
| assessment_score | Điểm theo criterion. |
| assessment_score_evidence | Liên kết evidence. |
| assessment_score_citation | Liên kết citation. |
| gap_record | Gap, severity, status, owner. |
| gap_evidence | Liên kết evidence. |
| gap_citation | Liên kết citation. |

### Roadmap & Transfer

| Entity | Mục đích |
| --- | --- |
| roadmap | Root/version/status. |
| roadmap_milestone | Mốc. |
| roadmap_task | Công việc. |
| milestone_dependency | Dependency edge. |
| milestone_gap | Milestone xử lý gap. |
| roadmap_review | Decision/review. |
| transfer_manifest | Root gói chuyển giao. |
| transfer_manifest_item | Resource version trong gói. |
| transfer_recipient | Người/tổ chức nhận. |

### Platform Operations

| Entity | Mục đích |
| --- | --- |
| content_flag | Báo cáo nội dung. |
| moderation_decision | Quyết định xử lý. |
| notification | Thông báo in-app/delivery. |
| audit_log | Append-only audit. |
| outbox_event | Reliable event publication. |
| idempotency_key | Chống command lặp. |

### 12.2 Invariant database quan trọng

1. Một organization có đúng một active ORG_OWNER.
2. Một case có đúng một active OWNER; owner thuộc owning organization.
3. PARTNER_MEMBER thuộc partner organization của case.
4. Resource có ít nhất một version; published version không update nội dung.
5. Citation offset hợp lệ và trỏ tới resource version tồn tại.
6. Evidence active và recommendation item active có citation.
7. Assessment score nằm trong range criterion và criterion thuộc framework version.
8. Milestone dependency không tự trỏ và không tạo cycle.
9. Roadmap không APPROVED khi critical gap OPEN/IN_PROGRESS.
10. Transfer không SHARED khi thiếu item/recipient; access grant có đúng một recipient target.
11. Content flag có đúng một target; moderation decision append-only.
12. Outbox/idempotency unique theo scope quy định.

### 12.3 Index baseline

- Unique: normalized email/identity subject, organization slug, domain, current version keys.
- Partial unique: active owner, active verification request, active membership, current published version.
- B-tree: tenant FK + status + created_at cho listing; case_id + status; recipient_id + notification status.
- GIN: full-text document, metadata JSONB chỉ khi có query thực tế.
- Vector index: resource_chunk.embedding sau khi có đủ dữ liệu và benchmark; không bật tùy tiện.
- Mọi index phải được kiểm tra bằng `EXPLAIN (ANALYZE, BUFFERS)` trên dataset gần production.

## 13. API contract

### 13.1 Quy ước chung

- Base path: `/v1`.
- JSON theo `camelCase`; UUID dạng string; thời gian ISO-8601 UTC.
- Write command quan trọng nhận `Idempotency-Key` và optional `If-Match`/aggregate version.
- Pagination cursor-based: `limit`, `after`, `before`; không dùng offset cho bảng lớn.
- List response: `{ data, pageInfo, meta }`.
- Error response chuẩn:

```json
{
  "error": {
    "code": "ROADMAP_CRITICAL_GAP_OPEN",
    "message": "Roadmap cannot be approved while critical gaps remain unresolved.",
    "details": { "gapIds": ["..."] },
    "traceId": "..."
  }
}
```

- Error code ổn định; message có thể localized.
- Controller không chứa business logic; gọi application command/query handler.

### 13.2 Endpoint catalogue

#### Identity/Organization

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`
- `GET /organizations`
- `POST /organizations/register`
- `PATCH /organizations/{id}`
- `POST /organizations/{id}/members/invitations`
- `PATCH /organizations/{id}/members/{memberId}`
- `POST /organizations/{id}/verification-requests`

#### Verification

- `POST /author-verifications/uploads`
- `POST /author-verifications`
- `GET /platform/author-verifications`
- `POST /platform/author-verifications/{id}/claim`
- `POST /platform/author-verifications/{id}/decision`

#### Resource

- `POST /resources`
- `GET /resources`
- `GET /resources/{id}`
- `POST /resources/{id}/versions`
- `POST /resource-versions/{id}/publish`
- `POST /resource-versions/{id}/annotations`
- `POST /annotations/{id}/revisions`
- `POST /resources/{id}/access-requests`

#### Discovery

- `POST /research-needs`
- `POST /research-needs/{id}/versions`
- `POST /research-needs/{id}/publish`
- `POST /research-needs/{id}/proposals`
- `POST /proposals/{id}/decision`
- `POST /research-needs/{id}/recommendation-runs`
- `GET /recommendation-runs/{id}`
- `POST /recommendation-items/{id}/case-initiation-requests`

#### Case/Evidence

- `POST /technology-cases`
- `GET /technology-cases`
- `GET /technology-cases/{id}`
- `POST /technology-cases/{id}/members`
- `POST /technology-cases/{id}/organizations`
- `POST /technology-cases/{id}/transitions`
- `POST /technology-cases/{id}/evidence`

#### Assessment/Gap

- `POST /technology-cases/{id}/assessments`
- `PUT /assessments/{id}/scores/{criterionId}`
- `POST /assessments/{id}/submit`
- `POST /assessments/{id}/decision`
- `POST /technology-cases/{id}/gaps`
- `POST /gaps/{id}/transition`

#### Roadmap/Transfer

- `POST /technology-cases/{id}/roadmaps`
- `POST /roadmaps/{id}/milestones`
- `POST /roadmaps/{id}/dependencies`
- `POST /roadmaps/{id}/submit`
- `POST /roadmaps/{id}/reviews`
- `POST /technology-cases/{id}/transfer-manifests`
- `POST /transfer-manifests/{id}/share`
- `POST /transfer-manifests/{id}/revoke`

#### Operations

- `POST /content-flags`
- `GET /platform/content-flags`
- `POST /platform/content-flags/{id}/decision`
- `GET /notifications`
- `POST /notifications/read`
- `GET /dashboard`
- `GET /audit-logs (admin/scoped)`

### 13.3 DTO và validation

- DTO command không dùng trực tiếp ORM model.
- Allowlist field; strip unknown hoặc reject theo endpoint policy.
- Chuỗi có max length; rich text phải sanitize; URL scheme allowlist.
- ID phải parse UUID và authorization trước khi trả “not found” chi tiết.
- File upload tách hai bước: presign → scan/complete; không stream file lớn qua API nếu không cần.
- Decimal/score dùng numeric rõ precision; không dùng floating point cho giá trị cần so sánh chính xác.

## 14. Event, outbox và background job

### 14.1 Domain event chính

- `OrganizationRegistered`
- `OrganizationActivated`
- `AuthorVerificationSubmitted`
- `AuthorVerified`
- `ResourceRegistered`
- `ResourceVersionPublished`
- `ResourceIngestionQueued`
- `ResearchNeedPublished`
- `ProposalSubmitted`
- `ProposalAccepted`
- `RecommendationRunQueued`
- `RecommendationRunCompleted`
- `CaseInitiationRequested`
- `TechnologyCaseCreated`
- `CaseStatusChanged`
- `EvidenceLinked`
- `AssessmentSubmitted`
- `AssessmentApproved`
- `CriticalGapRaised`
- `RoadmapApproved`
- `TransferManifestShared`
- `ContentFlagCreated`
- `ModerationDecisionRecorded`
- `NotificationRequested`

### 14.2 Outbox contract

- Event ghi vào `outbox_event` trong cùng transaction với aggregate.
- Worker claim bằng `FOR UPDATE SKIP LOCKED` hoặc queue bridge tương đương.
- Handler phải idempotent theo event ID.
- Có retry exponential backoff, max attempts và dead-letter state.
- Payload chỉ chứa ID và snapshot tối thiểu; consumer query dữ liệu khi cần và vẫn phải authorization/system-scope hợp lệ.
- Schema event có `eventId`, `eventType`, `aggregateType`, `aggregateId`, `occurredAt`, `actorId`, `tenantId`, `correlationId`, `version`, `payload`.

### 14.3 Job catalogue

| Job | Trigger | Kết quả/Retry |
| --- | --- | --- |
| Resource ingestion | ResourceVersion published | Extract text, chunk, hash; retry; FAILED có reason |
| Embedding generation | Chunk created/updated | Vector + model version; batch/retry |
| Recommendation pipeline | RecommendationRun queued | Retrieval → rank → citations → completed/failed |
| Notification delivery | NotificationRequested | In-app/email; dedupe/retry/dead-letter |
| Access expiration | Scheduled | Mark grant/manifest expired |
| Audit/archive/retention | Scheduled | Archive hoặc delete theo policy/legal hold |
| Materialized view refresh | Event/schedule | Dashboard/search read model cập nhật |

## 15. Thiết kế AI Recommendation và Retrieval

### 15.1 Nguyên tắc an toàn và truy vết

- Permission filter được áp dụng **trước retrieval**; không retrieve rồi mới che kết quả.
- Model input ghi hash/snapshot reference; prompt template và model version được lưu.
- LLM chỉ sinh rationale từ candidate context đã truy xuất; không tự tạo citation ID.
- Citation được validator map tới resource chunk/version và kiểm tra snippet/offset.
- Không có citation hợp lệ thì item không ACTIVE.
- Human selection/consent bắt buộc trước khi tạo case.
- Sensitive verification documents không tham gia retrieval.

### 15.2 Pipeline

```text
Need Statement Version
  → Query normalization
  → Access-scoped candidate retrieval (FTS/vector)
  → Metadata filters
  → Reranking
  → Rationale generation from retrieved chunks
  → Citation validation
  → Recommendation items
  → Human review/selection
```

### 15.3 Chỉ số đánh giá AI

| Metric | Mục tiêu baseline |
| --- | --- |
| Citation validity | 100% active item có citation mở được và locator hợp lệ |
| Permission leakage | 0 trong security test |
| Precision@K / nDCG | Theo tập đánh giá chuyên gia; baseline được chốt trước release |
| Unsupported claim rate | Theo evaluator + human audit; blocker nếu vượt ngưỡng release |
| Latency | Async; progress visible; không khóa request web dài |
| Reproducibility | Lưu model/prompt/config/input version và candidate IDs |

## 16. Security, privacy và compliance-oriented controls

- TLS toàn bộ; encryption at rest cho DB/object storage/backups.
- Password dùng Argon2id nếu hỗ trợ local identity; OAuth/OIDC state, PKCE và secure cookie.
- MFA bắt buộc cho Platform Reviewer/Admin; khuyến nghị cho Org Owner.
- CSRF protection cho cookie session; CORS allowlist; CSP và secure headers.
- Rate limit theo IP/user/tenant/endpoint; stricter cho auth, upload, AI jobs.
- Object storage private; signed URL TTL ngắn; malware scan; MIME sniff; size quota.
- Secrets ở secret manager, không trong repo/log.
- Audit append-only, integrity monitoring; PII redaction trong logs.
- RLS policy theo organization/case sau khi integration test đạt; service role tách worker/migration.
- Backup encrypted; restore drill định kỳ.
- Data retention và deletion phải có policy được pháp lý/tổ chức xác nhận; legal hold ưu tiên.

### 16.1 Threats trọng yếu

| Nguy cơ | Control |
| --- | --- |
| Cross-tenant data leak | Scope repository + authz policy + RLS + security tests |
| IDOR | Authorize resource/case sau lookup scoped; không tin ID client |
| Malicious upload | Quarantine, MIME/size validation, malware scan, signed URL |
| Prompt injection trong resource | Treat content as untrusted data; tool allowlist; no secret in prompt |
| AI data exfiltration | Access-scoped retrieval, provider policy, redaction, audit |
| Duplicate command | Idempotency key + unique constraints |
| Lost async event | Transactional outbox + retry/dead-letter |
| Privilege escalation | Role separation, no mass assignment, change audit, MFA |

## 17. Yêu cầu phi chức năng (NFR/SLO baseline)

| ID | Yêu cầu baseline | Cách đo |
| --- | --- | --- |
| NFR-01 | Availability mục tiêu 99.9%/tháng cho API production, loại trừ maintenance đã thông báo | Synthetic probe + uptime |
| NFR-02 | API query thông thường p95 ≤ 400 ms, p99 ≤ 1 s trong tải baseline | APM |
| NFR-03 | Dashboard p95 ≤ 2 s; partial widget response được phép | Frontend RUM/APM |
| NFR-04 | Search p95 ≤ 2 s; AI recommendation là async có progress | Tracing/job metrics |
| NFR-05 | Không mất event đã commit; outbox lag p95 ≤ 30 s | Outbox metrics |
| NFR-06 | RPO mục tiêu 15 phút; RTO mục tiêu 4 giờ | Backup/restore drill |
| NFR-07 | Zero critical/high cross-tenant finding trước release | Security test/pentest |
| NFR-08 | WCAG 2.1 AA cho luồng chính | Automated + manual a11y test |
| NFR-09 | Mọi write quan trọng có traceId và audit | Log/audit coverage test |
| NFR-10 | Schema migration backward-compatible trong rolling deploy hoặc có maintenance plan | CI migration test |

### 17.1 Capacity assumption ban đầu

Thiết kế và load test ban đầu nên dùng giả định: 10.000 user, 1.000 organization, 100 concurrent active sessions, 100.000 resource, tối đa vài triệu chunk. Đây là baseline kỹ thuật để test, không phải dự báo kinh doanh; phải cập nhật khi có số liệu thật.

## 18. Observability và vận hành

- Structured JSON logs với traceId, spanId, actorId hash/scoped ID, tenantId, route, status, latency.
- OpenTelemetry trace xuyên web → API → DB → queue → worker.
- Metrics: request rate/error/latency, DB pool, slow query, queue lag, job failure, outbox age, signed URL errors, auth failures, AI token/cost/latency.
- Alert: error rate, cross-tenant policy denial spike, queue dead-letter, backup failure, DB storage, RPO violation.
- Runbook cho: DB outage, Redis outage, object storage outage, provider AI outage, migration rollback, leaked credential, data access incident.
- Feature flags cho AI recommendation, RLS rollout và risky workflows.

## 19. Testing strategy

### 19.1 Test pyramid

- **Unit:** value object, transition policy, score calculation, dependency cycle, permission decision.
- **Integration:** repository + PostgreSQL thật, constraints, transaction rollback, RLS, outbox, object storage adapter.
- **Contract:** OpenAPI request/response và generated client.
- **E2E:** 20 use case chính và supporting flows trên môi trường gần production.
- **Security:** IDOR, cross-tenant, role escalation, upload, SSRF, injection, auth/session, AI prompt injection.
- **Performance:** dashboard, search, bulk notification, ingestion và recommendation queue.

### 19.2 Test bắt buộc theo domain

| Domain | Test blocker |
| --- | --- |
| Organization | Không tạo hai owner; không xóa owner cuối cùng |
| Verification | Concurrent review; self-review denied; private document access |
| Resource | Published version immutable; citation locator validation |
| Case | Exactly one owner; partner member validation; transition blockers |
| Assessment | Score range; missing evidence/citation; composite calculation |
| Roadmap | Cycle detection; critical gap blocker; version immutability |
| Transfer | Recipient/item required; revoke immediate; expired grant denied |
| AI | Permission leakage 0; citation validity; stale resource handling |

## 20. CI/CD, môi trường và migration

### 20.1 Môi trường

- `local`: Docker Compose cho PostgreSQL/Redis/MinIO; mock mail/AI tùy chọn.
- `dev`: shared nhưng tenant test riêng; dữ liệu không nhạy cảm.
- `staging`: cấu hình gần production; migration, load, security và restore test.
- `production`: managed services, private networking, secret manager, monitoring và backup.

### 20.2 Pipeline

1. Lint, typecheck, unit test.
2. Build packages/apps.
3. Start ephemeral PostgreSQL; apply migration baseline + constraints + seed.
4. Integration/contract/security smoke tests.
5. Build and scan container/SBOM.
6. Deploy staging; E2E and migration verification.
7. Manual approval cho production khi có schema/risky change.
8. Deploy app compatible trước, migration expand/contract, verify metrics; rollback plan sẵn.

### 20.3 Migration baseline

```text
packages/db/migrations/
  0001_v5_baseline.sql
  0002_v5_constraints.sql
  0003_v5_rls.sql
  0004_v5_seed_framework.sql
```

Vì dự án đang ở giai đoạn thiết kế, tạo baseline V5 sạch thay vì ALTER V4 chắp vá. Chỉ viết data migration nếu có dữ liệu thật cần giữ. Migration phải chạy trên database trống và được kiểm tra drift trong CI.

## 21. Roadmap triển khai để bắt đầu vibe coding

| Phase | Phạm vi | Exit criteria |
| --- | --- | --- |
| Phase 0 — Spec lock | Glossary, state machine, permission matrix, DBML/SQL, OpenAPI skeleton, ADR | Không còn quyết định kiến trúc mơ hồ |
| Phase 1 — Foundation | Auth, user, organization, membership, audit, outbox, idempotency | Register org + tenant-safe base |
| Phase 2 — Verification & Resource | Author verification, storage, resource/version, annotation, citation, ingestion | Resource traceability hoàn chỉnh |
| Phase 3 — Case & Evidence | Technology Case, members/orgs, lifecycle, evidence/access | Case không mồ côi; evidence có citation |
| Phase 4 — Assessment/Gap/Roadmap | Framework, assessment, gap, roadmap/dependency/review | End-to-end readiness workflow |
| Phase 5 — Company & Discovery | Company, need/version, proposal, retrieval/recommendation, initiation | Discovery tạo case có consent |
| Phase 6 — Transfer & Operations | Transfer, moderation, notification, dashboard | Business flow gần đầy đủ |
| Phase 7 — Production hardening | RLS, load/security test, backup/restore, observability, incident runbooks | Đạt release checklist |

### 21.1 Cấu trúc task cho AI coding agent

Mỗi task vibe coding MUST cung cấp:

1. Use case ID và business invariant.
2. Bảng/aggregate được phép thay đổi.
3. DTO và endpoint/OpenAPI.
4. Permission policy.
5. Transaction boundary.
6. Error codes.
7. Event/audit cần ghi.
8. Unit/integration/acceptance tests.
9. Không được tự đổi schema ngoài task; thay đổi schema phải có migration và cập nhật spec.

## 22. Definition of Ready và Definition of Done

### 22.1 Feature Ready

- Có use case, actor, pre/postcondition và acceptance criteria.
- Permission và tenant scope rõ.
- Data model/API/event/error xác định.
- UX state loading/empty/error/permission xác định.
- Không còn câu “tùy chọn A hoặc B” ở quyết định bắt buộc.

### 22.2 Backend Done

- Code qua lint/typecheck/review.
- Migration + rollback/forward plan.
- Unit/integration/contract tests pass.
- Authorization/cross-tenant tests pass.
- Audit/outbox/idempotency đúng yêu cầu.
- OpenAPI và generated client cập nhật.
- Observability và error code có.
- Không có critical/high security issue.

### 22.3 Production Ready

- E2E 20 use case và supporting flows pass trên staging.
- Load/SLO đạt baseline.
- Backup restore drill đạt RPO/RTO.
- Alert/runbook/on-call ownership sẵn sàng.
- Secret, access review, MFA, vulnerability scan và dependency policy đạt.
- Data retention/privacy policy được phê duyệt.
- Có release checklist, rollback và incident response.

## 23. Risk register và quyết định cần quản lý

| ID | Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- | --- |
| R-01 | Schema quá lớn cho MVP | Medium | Triển khai theo phase; không bỏ invariant; có thể trì hoãn UI/entity không dùng nhưng giữ design |
| R-02 | AI recommendation thiếu chất lượng/citation | High | Human-in-loop, evaluation set, validator, feature flag |
| R-03 | Cross-tenant leak | Critical | Authz library, scoped repository, RLS, security test |
| R-04 | Resource external URL thay đổi | High | Version hash/snapshot metadata, stale detection, provenance |
| R-05 | Roadmap/assessment workflow phức tạp | Medium | State machine và domain tests trước UI |
| R-06 | Vibe coding tự ý đổi kiến trúc | High | Task contract, schema lock, ADR, CI migration drift check |
| R-07 | Chi phí ingestion/AI | Medium | Async queue, quotas, caching, model policy, cost metrics |
| R-08 | Yêu cầu pháp lý/IP khác nhau | High | Policy configurable; legal review; không tự kết luận hợp pháp |

### 23.1 ADR bắt buộc

- ADR-001 Modular Monolith thay microservices.
- ADR-002 PostgreSQL + Drizzle + raw SQL constraints.
- ADR-003 Permission ba tầng.
- ADR-004 ResourceVersion immutable và citation bắt buộc.
- ADR-005 Transactional outbox.
- ADR-006 AI human-in-the-loop và citation validator.
- ADR-007 Dashboard là read model, không phải source table.
- ADR-008 RLS rollout sau policy integration tests.

## 24. Ma trận truy vết yêu cầu

| Capability | Use case | Entity chính | Test truy vết |
| --- | --- | --- | --- |
| Organization/Auth | UC-ORG-01, SUC-01..03 | user_account, organization, member, verification | Register/activate/member tests |
| Author Verification | UC-VER-01..02 | author_profile, request, document | Submit/review/concurrency/private access |
| Resource | UC-RES-01..02, SUC-04..05 | resource/version/chunk/citation/annotation/grant | Version immutability/citation/access |
| Discovery | UC-DIS-01..04, SUC-08 | need/version/proposal/recommendation/initiation | Version/provenance/consent |
| Technology Case | UC-CASE-01, UC-EVD-01, SUC-06..07 | case/origin/org/member/history/evidence | Owner/transition/evidence |
| Assessment & Gap | UC-ASM-01, UC-GAP-01, SUC-09 | framework/criterion/assessment/score/gap | Range/completeness/blockers |
| Roadmap & Transfer | UC-RDM-01, UC-TRF-01, SUC-10 | roadmap/task/dependency/review/manifest/grant | Cycle/critical gap/share/revoke |
| Operations | UC-MOD-01, UC-SYS-01..03, SUC-11..12 | flag/decision/notification/audit/outbox/idempotency | Moderation/tenant dashboard/reliability |

## 25. Phụ lục chuẩn tắc

Các artefact đi kèm trong cùng gói:

- `schema_v5_production.dbml` — mô hình 59 bảng và enum/relations.
- `production_constraints_and_indexes.sql` — constraint, partial unique index, trigger và RLS skeleton.
- `USE_CASE_COVERAGE_MATRIX.md` — ma trận use case/aggregate/invariant/event.
- `V4_TO_V5_MIGRATION_PLAN.md` — kế hoạch chuyển baseline.
- `R2M_V5_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` — tài liệu kiến trúc nguồn trước khi hợp nhất.

Khi triển khai, cần sinh thêm:

- `openapi-v1.yaml`.
- Permission policy catalogue dạng testable code.
- Seed assessment framework version 1.
- ERD render từ DBML.
- ADR files.
- Threat model và runbooks.

## 26. Kết luận baseline

V5 được coi là **implementation baseline** khi DBML import thành công, migration chạy trên PostgreSQL trống, SQL constraints pass, OpenAPI skeleton được chốt và permission/state-machine tests đầu tiên tồn tại. V5 được coi là **production-ready implementation** chỉ sau khi các Definition of Done, SLO, security, backup/restore và operation checklist trong tài liệu này đều đạt.

Hướng triển khai đúng là bắt đầu từ **Phase 0 và Phase 1**, không bắt đầu bằng AI Recommendation. Identity, tenancy, resource versioning, citation và Technology Case là nền móng; nếu các phần này sai, mọi assessment, roadmap và transfer phía sau sẽ phải sửa lại.
