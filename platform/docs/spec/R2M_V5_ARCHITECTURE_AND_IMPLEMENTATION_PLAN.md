# Research-to-Market Platform — V5 Production Blueprint

## 1. Mục tiêu của bản V5

Bản V5 thay thế schema V4 bằng một mô hình có thể triển khai backend thực tế, với các mục tiêu:

1. Phủ đủ 20 use case hiện tại.
2. Không dùng JSONB để thay thế quan hệ nghiệp vụ quan trọng.
3. Tách rõ quyền cấp nền tảng, quyền trong tổ chức và quyền trong Technology Case.
4. Mọi recommendation, assessment, gap và transfer đều truy vết được đến Resource Version và Citation.
5. Hỗ trợ multi-tenant, audit, idempotency, background job và bảo mật dữ liệu.
6. Cho phép bắt đầu bằng modular monolith nhưng vẫn có thể tách service sau này.

---

## 2. Kiến trúc nên chọn

### Quyết định

Sử dụng **modular monolith** thay vì microservice ở giai đoạn đầu.

```text
Web application
      ↓
REST API / OpenAPI
      ↓
Modular Monolith Backend
      ├── Identity & Organization
      ├── Verification
      ├── Resource Catalog
      ├── Discovery
      ├── Technology Case
      ├── Assessment & Gap
      ├── Roadmap & Transfer
      └── Platform Operations
      ↓
PostgreSQL + Object Storage + Queue/Cache
```

### Vì sao đây là phương án tối ưu

- Có transaction xuyên module, rất cần khi chấp nhận proposal hoặc initiation request rồi tạo Technology Case.
- Dễ triển khai và debug hơn microservice.
- Vẫn tách module đủ rõ để sau này tách Recommendation Worker, Notification Worker hoặc Search Service.
- Phù hợp vibe coding vì mỗi module có phạm vi nhỏ, DTO và policy rõ ràng.

### Stack triển khai đề xuất

- Frontend: Next.js App Router.
- Backend: NestJS theo module hoặc một Node.js backend có cấu trúc module tương đương.
- Database: PostgreSQL.
- ORM/migration: Drizzle hoặc Prisma; chỉ chọn một.
- Object storage: S3-compatible storage cho hồ sơ xác minh và file nội bộ được phép lưu.
- Queue: BullMQ/Redis hoặc queue tương đương cho ingestion, embedding, recommendation và notification.
- Search: PostgreSQL full-text; bổ sung pgvector khi triển khai semantic retrieval.
- API: REST + OpenAPI trong MVP; chưa cần GraphQL.

---

## 3. Tám bounded context chính thức

### 3.1 Identity & Organization

Aggregate roots:

- UserAccount
- Organization
- OrganizationMembership

Trách nhiệm:

- Danh tính người dùng.
- Liên kết nhiều phương thức đăng nhập.
- Tổ chức và domain xác minh.
- Thành viên, lời mời và vai trò trong tổ chức.

### 3.2 Verification

Aggregate roots:

- OrganizationVerificationRequest
- AuthorProfile
- AuthorVerificationRequest

Trách nhiệm:

- Xác minh tổ chức.
- Xác minh tác giả.
- Quản lý tài liệu xác minh bảo mật.
- Ghi lại reviewer và quyết định.

### 3.3 Resource Catalog & Evidence

Aggregate roots:

- Resource
- ResourceVersion
- Annotation
- Evidence
- Citation

Trách nhiệm:

- Quản lý paper, dataset, model, source code, patent và tài liệu liên quan.
- Versioning thống nhất cho tất cả loại Resource.
- Trích xuất nội dung và chia chunk phục vụ AI.
- Citation có page/section/offset rõ ràng.
- Kiểm soát quyền truy cập Resource.

### 3.4 Company & Discovery

Aggregate roots:

- ResearchNeed
- ResearchProposal
- RecommendationRun
- CaseInitiationRequest

Trách nhiệm:

- Company Profile.
- Nhu cầu nghiên cứu có version.
- Proposal của tác giả.
- Kết quả recommendation có item, score và citation.
- Yêu cầu khởi tạo Technology Case cần Author consent.

### 3.5 Technology Case

Aggregate roots:

- TechnologyCase
- TechnologyProfile

Trách nhiệm:

- Quản lý lifecycle của công nghệ.
- Tổ chức sở hữu, doanh nghiệp đối tác và reviewer organization.
- Thành viên và vai trò trong từng case.
- Lịch sử chuyển trạng thái.
- Nguồn tạo case: manual, recommendation hoặc proposal.

### 3.6 Readiness Assessment & Gap

Aggregate roots:

- AssessmentFramework
- ReadinessAssessment
- GapRecord

Trách nhiệm:

- Rubric có version.
- Mỗi điểm số có rationale, Evidence và Citation.
- Composite score.
- Gap có severity, status, owner và resolution.

### 3.7 Roadmap & Transfer

Aggregate roots:

- Roadmap
- TransferManifest

Trách nhiệm:

- Roadmap có version và approval.
- Milestone, task và dependency chuẩn hóa.
- Chặn circular dependency.
- Chặn approve khi còn CRITICAL gap chưa xử lý.
- Transfer chỉ chứa manifest, metadata, location và access grant.

### 3.8 Platform Operations

Aggregate roots:

- ContentFlag
- Notification
- AuditLog
- OutboxEvent
- IdempotencyKey

Trách nhiệm:

- Moderation.
- Notification.
- Audit.
- Reliable event delivery.
- Chống xử lý request lặp.

---

## 4. Mô hình quyền ba tầng

### 4.1 Platform role

Chỉ dùng cho quyền toàn hệ thống:

```text
USER
PLATFORM_REVIEWER
PLATFORM_ADMIN
```

Không dùng `AUTHOR` hoặc `COMPANY_MEMBER` làm platform role. Một người có thể vừa là tác giả vừa là thành viên doanh nghiệp trong các tổ chức khác nhau.

### 4.2 Organization membership

```text
ORG_OWNER
ORG_ADMIN
MEMBER
```

Lưu tại `organization_member`.

### 4.3 Technology Case membership

```text
OWNER
TECHNICAL_MEMBER
CASE_REVIEWER
PARTNER_MEMBER
VIEWER
```

Lưu tại `case_member`.

### Quy tắc bắt buộc

- Mỗi Organization có đúng một active ORG_OWNER.
- Mỗi Technology Case có đúng một active OWNER.
- Case owner phải thuộc owning organization.
- PARTNER_MEMBER phải thuộc một organization đang có role PARTNER_COMPANY trong case.
- Platform reviewer không tự động có quyền sửa case; họ chỉ có quyền kiểm duyệt cấp nền tảng, trừ khi được thêm làm CASE_REVIEWER.

---

## 5. Lifecycle chính thức

### 5.1 Organization

```text
PENDING_VERIFICATION → ACTIVE
PENDING_VERIFICATION → REJECTED
ACTIVE → SUSPENDED → ACTIVE
ACTIVE/SUSPENDED → ARCHIVED
```

### 5.2 Author profile

```text
UNVERIFIED → PENDING → VERIFIED
                     ↘ DECLINED → PENDING
VERIFIED → SUSPENDED
```

### 5.3 Research Need

```text
DRAFT → OPEN → PAUSED → OPEN
             ↘ CLOSED → ARCHIVED
```

### 5.4 Proposal

```text
DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED
                                  ↘ REJECTED
SUBMITTED/UNDER_REVIEW → WITHDRAWN
```

### 5.5 Case initiation request

```text
PENDING → ACCEPTED
        ↘ DECLINED
        ↘ CANCELLED
        ↘ EXPIRED
```

### 5.6 Technology Case

```text
DRAFT
  ↓
EVIDENCE_COLLECTION
  ↓
UNDER_ASSESSMENT
  ↓
GAP_IDENTIFIED
  ↓
ROADMAP_DRAFT
  ↓
ROADMAP_APPROVED
  ↓
PILOT_READY
  ↓
TRANSFER_READY
  ↓
COMMERCIALIZED
  ↓
ARCHIVED
```

Mọi lần chuyển trạng thái phải tạo `case_status_history` trong cùng transaction.

### 5.7 Roadmap

```text
DRAFT → IN_REVIEW → APPROVED → ACTIVE → COMPLETED
                  ↘ REJECTED
DRAFT/APPROVED → SUPERSEDED
```

### 5.8 Transfer Manifest

```text
DRAFT → READY → SHARED → EXPIRED
                    ↘ REVOKED
```

---

## 6. Các sửa đổi quan trọng so với V4

| V4 | V5 |
|---|---|
| `UserAccount.role` chứa ADMIN/REVIEWER/AUTHOR/COMPANY | Chỉ còn platform role; Author và Company được xác định bằng profile/membership |
| Một user chỉ thuộc một organization | Có `organization_member`, hỗ trợ nhiều tổ chức |
| `VerificationStatus` dùng chung | Tách Organization, Author và Request status |
| Paper tự chứa version | Tất cả Resource dùng `resource_version`; Paper chỉ là subtype metadata |
| Annotation gắn trực tiếp Paper | Annotation gắn `resource_version` và có `annotation_revision` |
| Recommendation lưu JSONB | Tách run, item và citation |
| TechnologyCase thiếu nguồn và partner | Có `case_origin`, `case_organization`, `case_member` |
| Evidence có `citation_details` text | Có entity `citation` và bảng nối |
| Assessment chỉ có score/comment | Có framework, criterion, score, evidence và citation |
| Gap thiếu status | Có status, owner, due date và resolution |
| Roadmap chỉ có milestone | Có roadmap, milestone, task, dependency, gap link và review |
| Transfer lưu metadata JSONB | Có manifest item, recipient và access grant |
| ContentFlag dùng content_type/content_id | Dùng FK tới các target được hỗ trợ và có moderation decision |
| Không có audit/outbox/idempotency | Bổ sung đầy đủ |

---

## 7. Nguyên tắc schema production-ready

### 7.1 ID và thời gian

- Dùng UUID cho entity public-facing.
- Dùng `timestamptz` cho timestamp.
- Mọi aggregate root có `created_at`, `updated_at`.
- Entity cần giữ lịch sử có `deleted_at` hoặc status ARCHIVED thay vì xóa vật lý.

### 7.2 Versioning

- Resource content: `resource_version`.
- Research Need input: `need_statement_version`.
- Annotation: `annotation_revision`.
- Assessment framework: version tại framework.
- Roadmap: `version_no`.
- Transfer manifest: `version_no`.

### 7.3 Không lạm dụng JSONB

JSONB chỉ dùng cho:

- Metadata thay đổi theo loại Resource.
- AI model parameters.
- Notification payload.
- Audit before/after snapshot.

Không dùng JSONB để lưu:

- Recommendation items.
- Roadmap tasks/dependencies.
- Transfer items/recipients.
- Citations.
- Roles.

### 7.4 Multi-tenant

- Mọi truy vấn tenant phải có organization context.
- Root entity phải có owning organization hoặc suy ra được bằng quan hệ bắt buộc.
- Backend policy là lớp kiểm soát chính.
- PostgreSQL RLS là lớp phòng vệ thứ hai cho các bảng tenant-critical.

### 7.5 Transaction boundary

Các use case sau phải chạy trong một database transaction:

1. Approve author verification → update request + author profile + audit + outbox.
2. Accept proposal → update proposal + create case + origin + owner/member + partner org + history + notifications.
3. Accept case initiation → update request + create case + origin + members + preserved citations + notifications.
4. Submit assessment → validate score/evidence/citation + calculate composite + status + audit.
5. Approve roadmap → validate critical gap + dependency graph + status/history.
6. Share transfer → create grants + update manifest + outbox notifications.

### 7.6 Concurrency

- Aggregate root mutable có `version` integer.
- Update theo điều kiện `WHERE id = ? AND version = ?`.
- Nếu row count bằng 0, trả `409 CONFLICT`.
- Idempotent endpoint nhận `Idempotency-Key`.

---

## 8. Backend module layout

```text
apps/
  web/
  api/
packages/
  db/
    schema/
    migrations/
    seeds/
  contracts/
  config/
  testkit/
```

Trong API:

```text
src/modules/
  auth/
  users/
  organizations/
  verification/
  resources/
  discovery/
  cases/
  evidence/
  assessments/
  gaps/
  roadmaps/
  transfers/
  moderation/
  notifications/
  audit/
  jobs/
```

Mỗi module:

```text
module.controller
module.service
module.repository
module.policy
module.events
dto/
tests/
```

Không tạo một `common.service.ts` khổng lồ. Policy phải nằm gần domain module.

---

## 9. API tối thiểu

### Organizations

```text
POST   /organizations
GET    /organizations/:id
POST   /organizations/:id/verification-requests
POST   /organizations/:id/members/invitations
PATCH  /organizations/:id/members/:memberId
```

### Author verification

```text
POST   /author-verification-requests
GET    /review/author-verification-requests
POST   /review/author-verification-requests/:id/approve
POST   /review/author-verification-requests/:id/reject
```

### Resources

```text
POST   /resources
POST   /resources/:id/versions
GET    /resources/:id
POST   /resources/:id/access-grants
POST   /resource-versions/:id/annotations
```

### Discovery

```text
POST   /research-needs
POST   /research-needs/:id/versions
POST   /research-needs/:id/publish
POST   /research-needs/:id/proposals
POST   /research-needs/:id/recommendation-runs
GET    /recommendation-runs/:id/items
POST   /recommendation-items/:id/case-initiation-requests
```

### Technology Cases

```text
POST   /technology-cases
GET    /technology-cases/:id
POST   /technology-cases/:id/members
POST   /technology-cases/:id/organizations
POST   /technology-cases/:id/transitions
POST   /technology-cases/:id/evidence
```

### Assessment, Gap, Roadmap

```text
POST   /technology-cases/:id/assessments
PUT    /assessments/:id/scores/:criterionId
POST   /assessments/:id/submit
POST   /assessments/:id/approve
POST   /technology-cases/:id/gaps
POST   /technology-cases/:id/roadmaps
POST   /roadmaps/:id/milestones
POST   /roadmaps/:id/submit
POST   /roadmaps/:id/approve
```

### Transfer

```text
POST   /technology-cases/:id/transfer-manifests
POST   /transfer-manifests/:id/items
POST   /transfer-manifests/:id/recipients
POST   /transfer-manifests/:id/share
POST   /transfer-manifests/:id/revoke
```

---

## 10. Error model thống nhất

```json
{
  "code": "ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS",
  "message": "Roadmap cannot be approved while critical gaps remain unresolved.",
  "details": {
    "gapIds": ["..."]
  },
  "requestId": "..."
}
```

Nhóm mã lỗi:

- `AUTH_*`
- `ORG_*`
- `VERIFICATION_*`
- `RESOURCE_*`
- `DISCOVERY_*`
- `CASE_*`
- `ASSESSMENT_*`
- `GAP_*`
- `ROADMAP_*`
- `TRANSFER_*`
- `MODERATION_*`

---

## 11. Event và background job

### Domain events quan trọng

```text
OrganizationRegistered
OrganizationActivated
AuthorVerificationSubmitted
AuthorVerified
ResearchNeedPublished
ProposalSubmitted
ProposalAccepted
RecommendationRunRequested
RecommendationRunCompleted
CaseInitiationRequested
TechnologyCaseCreated
EvidenceLinked
AssessmentSubmitted
AssessmentApproved
CriticalGapCreated
RoadmapApproved
TransferManifestShared
ContentFlagCreated
ModerationDecisionRecorded
```

Event được ghi vào `outbox_event` cùng transaction với thay đổi nghiệp vụ. Worker đọc outbox để gửi notification, email hoặc chạy tác vụ ngoài hệ thống.

### Jobs

- Resource metadata validation.
- Text extraction.
- Chunking và embedding.
- AI recommendation.
- Notification delivery.
- Transfer expiration.
- Cleanup tài liệu xác minh hết retention.

---

## 12. Security production checklist

- Không lưu password thô; ưu tiên auth provider hoặc hash mạnh trong identity provider layer.
- Verification documents dùng private bucket, encryption và signed URL ngắn hạn.
- Không log document URL, token, email đầy đủ hoặc nội dung nhạy cảm.
- RBAC + ownership policy ở service layer.
- RLS cho bảng tenant-critical.
- Rate limit login, verification upload, recommendation và proposal submit.
- Virus/malware scan cho file upload.
- Kiểm tra MIME thực tế, không chỉ extension.
- Audit tất cả approve/reject, role change, access grant, transfer share và moderation.
- Secret chỉ nằm trong secret manager/environment, không commit.
- CSRF/CORS/cookie policy cấu hình theo mô hình auth.
- Backup tự động và kiểm thử restore định kỳ.

---

## 13. Testing bắt buộc

### Unit tests

- Permission policy.
- State transition.
- Composite score.
- Critical gap rule.
- Dependency cycle detection.

### Integration tests

- Repository với PostgreSQL thật.
- Unique/foreign key/check constraint.
- Transaction rollback.
- RLS policy.
- Outbox creation.

### End-to-end tests

1. Register organization → activate → invite member.
2. Submit verification → approve → create Resource.
3. Publish need → generate recommendation → initiate case → author accepts.
4. Link evidence → assess → create gaps → approve roadmap.
5. Create transfer → grant access → revoke/expire.
6. Flag content → moderate → notify parties.

### Security tests

- Cross-tenant data access.
- Broken object-level authorization.
- Privilege escalation.
- Replayed idempotent request.
- Signed URL expiration.

---

## 14. Lộ trình triển khai

### Phase 0 — Spec lock

Hoàn thành:

- Glossary.
- State machines.
- Permission matrix.
- API error catalog.
- Schema V5.
- OpenAPI skeleton.

Definition of Done:

- Không còn entity được nhắc trong use case nhưng không tồn tại trong schema.
- Mỗi write use case có actor, permission, input, transaction, state transition, event và audit.

### Phase 1 — Platform foundation

- User, identity, profile.
- Organization, domain, verification, membership.
- Authentication/authorization.
- Audit, outbox, idempotency.

### Phase 2 — Author & Resource

- Author verification.
- Resource, version, paper metadata.
- Annotation revision.
- Access grant.
- Ingestion/chunk pipeline.

### Phase 3 — Technology Case & Evidence

- Case, origin, organizations, members.
- Lifecycle history.
- Citation và Evidence.

### Phase 4 — Assessment, Gap, Roadmap

- Framework/criterion.
- Assessment score + evidence + citation.
- Gap workflow.
- Roadmap, task, dependency, approval.

### Phase 5 — Company & Discovery

- Company profile.
- Research need version.
- Proposal.
- Recommendation run/item/citation.
- Case initiation.

### Phase 6 — Transfer & Moderation

- Transfer manifest/item/recipient/access grant.
- Content flag và moderation decision.
- Notifications và dashboard projections.

### Phase 7 — Production hardening

- RLS.
- Rate limiting.
- Queue retry/dead-letter.
- Metrics/tracing/logging.
- Backup/restore.
- Load test.
- Security review.

---

## 15. Mẫu bắt buộc cho mỗi use case mới

```text
Use Case ID:
Name:
Goal:
Actors:
Required platform role:
Required organization role:
Required case role:
Preconditions:
Input DTO:
Read models:
Write entities:
Transaction boundary:
Main flow:
Alternative flows:
State transition:
Business invariants:
Authorization checks:
Domain events:
Notifications:
Audit fields:
Idempotency behavior:
Error codes:
Acceptance tests:
```

Bất kỳ use case nào chưa có các mục trên vẫn chỉ là business note, chưa đủ để vibe coding an toàn.

---

## 16. Definition of “backend implementation-ready”

Dự án đạt implementation-ready khi:

- Schema migration chạy được trên database trống.
- Seed tạo được framework/rubric và tài khoản test.
- OpenAPI định nghĩa đủ endpoint MVP.
- Permission matrix được test.
- State transition được test.
- Mỗi write endpoint có transaction, audit và outbox.
- Không còn polymorphic relation không kiểm soát ở nghiệp vụ chính.
- Không dùng JSONB thay cho entity cốt lõi.

## 17. Definition of “production-ready”

Dự án chỉ được gọi production-ready khi:

- Cross-tenant authorization test đạt.
- Backup và restore test đạt.
- Migration rollback/forward strategy rõ ràng.
- Observability có logs, metrics, traces và request ID.
- Background jobs có retry, dead-letter và idempotency.
- File upload có validation và malware scanning.
- PII và verification documents có retention/encryption.
- Audit không thể bị sửa bởi user thông thường.
- Load test các luồng dashboard, recommendation và case list đạt mục tiêu đã định.
- Có quy trình incident response và secret rotation.

