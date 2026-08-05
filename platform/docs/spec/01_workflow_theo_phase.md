# R2M V5 — Workflow triển khai theo từng Phase (bản chi tiết)

> Tài liệu này diễn giải lộ trình triển khai (mục 14, `R2M_V5_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md`) thành **workflow thao tác được ở mức sprint/endpoint**. Mỗi phase gồm 8 mục cố định:
> 1. Vị trí trong lộ trình (phụ thuộc/mở khóa phase nào)
> 2. Mục tiêu & phạm vi
> 3. Breakdown theo nhóm công việc (sub-workflow)
> 4. Danh sách API/endpoint & transaction boundary
> 5. Business rule / invariant bắt buộc
> 6. Error code liên quan
> 7. Testing checklist
> 8. Rủi ro & lưu ý triển khai
> 9. Definition of Done (checklist)
>
> Sơ đồ Use Case tổng thể: xem `02_usecase_diagram.md`.
> Sơ đồ Activity chi tiết từng phase: xem `03_activity_diagrams.md`.

---

## Phase 0 — Spec Lock

### 0.1 Vị trí trong lộ trình
- **Phụ thuộc:** không — đây là điểm bắt đầu.
- **Mở khóa:** toàn bộ Phase 1–7. Không phase nào được bắt đầu code khi Phase 0 chưa đạt DoD.

### 0.2 Mục tiêu & phạm vi
Khóa toàn bộ đặc tả trước khi viết code, tránh "vibe coding" không kiểm soát. Không thuộc bounded context nghiệp vụ nào — đây là hoạt động tài liệu hóa/quản trị spec.

### 0.3 Breakdown theo nhóm công việc

**Nhóm A — Glossary & Domain language**
1. Liệt kê toàn bộ danh từ nghiệp vụ xuất hiện trong 20 use case (Resource, Resource Version, Case, Evidence, Citation, Gap, Roadmap, Transfer Manifest...).
2. Với mỗi danh từ: định nghĩa 1 câu, entity tương ứng trong schema, phân biệt với danh từ dễ nhầm (vd: `Evidence` vs `Citation` vs `Annotation`).
3. Review chéo giữa người viết spec và người sẽ code để đảm bảo hiểu thống nhất.

**Nhóm B — State machine**
4. Vẽ lại 8 state machine (mục 5 architecture plan) dưới dạng bảng transition: `from_state | event/action | to_state | guard condition`.
5. Với mỗi transition, ghi rõ actor được phép kích hoạt và bảng `*_status_history`/`*_review` tương ứng phải ghi log.

**Nhóm C — Permission matrix**
6. Lập ma trận `resource/action × (platform role, organization role, case role)` — output dạng bảng có thể convert trực tiếp thành policy test.
7. Đánh dấu rõ hành động nào chỉ cần platform role, hành động nào cần thêm case role cụ thể (vd: PLATFORM_REVIEWER không tự có quyền sửa case trừ khi được thêm CASE_REVIEWER).

**Nhóm D — API & Error catalog**
8. Viết OpenAPI skeleton cho toàn bộ endpoint mục 9 (path, method, request/response DTO tối thiểu, mã lỗi có thể trả).
9. Lập bảng mã lỗi đầy đủ theo nhóm `AUTH_*, ORG_*, VERIFICATION_*, RESOURCE_*, DISCOVERY_*, CASE_*, ASSESSMENT_*, GAP_*, ROADMAP_*, TRANSFER_*, MODERATION_*` — mỗi mã có message mẫu và HTTP status.

**Nhóm E — Schema lock**
10. Import `schema_v5_production.dbml` vào công cụ ERD, review 59 bảng/46 enum với toàn team.
11. Đối chiếu từng use case trong `USE_CASE_COVERAGE_MATRIX.md` với schema — không được còn entity "nhắc tới nhưng chưa có bảng".
12. Áp `production_constraints_and_indexes.sql` (check constraint, partial unique index, trigger) trên schema thử nghiệm để xác nhận không lỗi cú pháp/logic.

**Nhóm F — Use case template**
13. Với **mỗi** trong 20 use case, điền đủ 15 mục template (mục 15 architecture plan): Actor, Required role (3 tầng), Preconditions, Input DTO, Read models, Write entities, Transaction boundary, Main flow, Alternative flows, State transition, Business invariants, Authorization checks, Domain events, Notifications, Audit fields, Idempotency behavior, Error codes, Acceptance tests.

### 0.4 Danh sách "endpoint" của Phase 0
Không có API thật; đầu ra là tài liệu. Checklist thay thế:

| Tài liệu | Trạng thái cần đạt |
|---|---|
| Glossary | Không còn thuật ngữ mơ hồ/đa nghĩa |
| State machine (8 lifecycle) | Đủ transition, đủ guard condition |
| Permission matrix | Phủ hết action trong 20 use case |
| API error catalog | Phủ hết nhóm mã lỗi mục 10 |
| OpenAPI skeleton | Phủ hết endpoint mục 9 |
| Use case template x20 | Đủ 15 mục/UC, không mục nào bỏ trống |

### 0.5 Business rule / invariant bắt buộc
- Một use case chỉ được coi là "sẵn sàng code" khi đủ transaction boundary + state transition + event + audit trong template.
- Không entity nào được thêm vào schema chỉ để "cho chắc" nếu không có use case nào dùng tới (tránh over-engineering — xem mục "Entity không nên thêm vào schema giao dịch" trong coverage matrix, ví dụ `dashboard_data`).

### 0.6 Error code liên quan
Không áp dụng (chưa có runtime). Tuy nhiên phải **định nghĩa xong** toàn bộ mã lỗi để Phase 1–6 dùng lại, tránh mỗi module tự đặt mã lỗi rời rạc.

### 0.7 Testing checklist
- [ ] Review glossary bởi ít nhất 2 người không phải tác giả spec.
- [ ] Mock permission matrix thành bảng test case (input: role × action → expect allow/deny) — dùng trực tiếp làm seed cho unit test Phase 1.
- [ ] Chạy `production_constraints_and_indexes.sql` trên PostgreSQL trống, xác nhận không lỗi.
- [ ] Đối chiếu 20/20 use case với coverage matrix — 100% có entity tương ứng.

### 0.8 Rủi ro & lưu ý triển khai
- Rủi ro lớn nhất: bỏ qua Phase 0 và code thẳng theo cảm tính → dẫn tới polymorphic relation không kiểm soát, JSONB lạm dụng (điều mà V5 sinh ra để sửa từ V4). Không rút ngắn phase này dù áp lực thời gian.
- Nên chốt version bảng permission matrix và state machine bằng file có version control (Git), không chỉ lưu trên tài liệu chat/slide.

### 0.9 Definition of Done
- [ ] Không còn entity được nhắc trong use case nhưng không tồn tại trong schema.
- [ ] Mỗi write use case có đủ actor, permission, input, transaction, state transition, event, audit.
- [ ] Toàn bộ 20 use case có bản template đầy đủ, đã review.
- [ ] OpenAPI skeleton + error catalog đã export ra file dùng chung cho backend team.

---

## Phase 1 — Platform Foundation

### 1.1 Vị trí trong lộ trình
- **Phụ thuộc:** Phase 0 (glossary, state machine Organization, permission matrix, schema Identity & Organization).
- **Mở khóa:** tất cả các phase sau — mọi actor, mọi authorization check đều dựa trên `user_account`, `organization_member`.

### 1.2 Mục tiêu & phạm vi
Dựng nền danh tính, tổ chức, phân quyền, audit. Bounded context: **Identity & Organization**, và một phần **Platform Operations** (audit, outbox, idempotency) vì các module sau đều cần dùng chung hạ tầng này ngay từ đầu.

### 1.3 Breakdown theo nhóm công việc

**Sprint 1.1 — Identity core**
1. Bảng `user_account` (UUID, platform_role ∈ {USER, PLATFORM_REVIEWER, PLATFORM_ADMIN}, created_at, updated_at, version).
2. Liên kết nhiều phương thức đăng nhập (bảng `user_auth_identity` hoặc tương đương — email/password, OAuth provider).
3. Bảng `user_profile` tách khỏi `user_account` (tên hiển thị, avatar, thông tin công khai).
4. Middleware auth (JWT/session) + resolver "current user" dùng chung cho toàn bộ API sau này.

**Sprint 1.2 — Organization**
5. Bảng `organization` (slug unique, name unique, type ∈ {RESEARCH_INSTITUTION, ENTERPRISE, ...}, status: `PENDING_VERIFICATION → ACTIVE → SUSPENDED → ACTIVE`, `ACTIVE/SUSPENDED → ARCHIVED`).
6. Bảng `organization_domain` (1 organization – N domain, domain unique toàn hệ thống để hỗ trợ auto-match theo email domain).
7. Bảng `organization_member` (role ∈ {ORG_OWNER, ORG_ADMIN, MEMBER}, status ACTIVE/REMOVED).
8. Bảng `organization_verification_request` (status riêng, không dùng chung enum verification với Author).

**Sprint 1.3 — Luồng đăng ký & xác minh tổ chức (UC1)**
9. `POST /organizations` → tạo `organization (PENDING_VERIFICATION)` + tự động gán người tạo làm `organization_member(role=ORG_OWNER)` trong cùng transaction.
10. `POST /organizations/:id/verification-requests` → tạo `organization_verification_request`.
11. Luồng review (nội bộ PLATFORM_REVIEWER, chưa cần UI riêng ở Phase 1 — có thể dùng endpoint quản trị) → approve/reject → cập nhật `organization.status`.
12. Invariant bắt buộc: mỗi Organization có **đúng một** ORG_OWNER đang ACTIVE tại mọi thời điểm (kiểm tra bằng partial unique index).

**Sprint 1.4 — Membership & Invitation**
13. `POST /organizations/:id/members/invitations` → tạo invitation (email, role dự kiến).
14. Accept invitation → tạo `organization_member` mới hoặc kích hoạt lại membership cũ.
15. `PATCH /organizations/:id/members/:memberId` → đổi role hoặc REMOVE — kiểm tra không tự hạ quyền ORG_OWNER cuối cùng.

**Sprint 1.5 — Platform Operations nền tảng**
16. Bảng `audit_log` (actor_id, action, target_type, target_id, before/after snapshot JSONB, created_at) — dùng cho mọi approve/reject/role change từ Phase 1 trở đi.
17. Bảng `outbox_event` (event_type, payload JSONB, status PENDING/PROCESSED, created_at) — ghi trong cùng transaction với thay đổi nghiệp vụ.
18. Bảng `idempotency_key` (key, request_hash, response_snapshot, expires_at) — áp dụng cho các endpoint POST quan trọng (register organization, invite member).
19. Middleware policy layer: RBAC + ownership check ở service layer (chưa bật RLS — RLS để dành Phase 7).

### 1.4 Danh sách API/endpoint & transaction boundary

| Method | Path | Actor | Transaction boundary | Event |
|---|---|---|---|---|
| POST | `/organizations` | User đã đăng nhập | tạo organization + organization_member(ORG_OWNER) | `OrganizationRegistered` |
| POST | `/organizations/:id/verification-requests` | ORG_OWNER | tạo verification_request | — |
| POST | `/organizations/:id/verification-requests/:reqId/approve` (nội bộ) | PLATFORM_REVIEWER | update request + organization.status=ACTIVE + audit + outbox | `OrganizationActivated` |
| POST | `/organizations/:id/members/invitations` | ORG_OWNER/ORG_ADMIN | tạo invitation + notification | — |
| POST | `/invitations/:id/accept` | User được mời | tạo/kích hoạt organization_member + audit | — |
| PATCH | `/organizations/:id/members/:memberId` | ORG_OWNER/ORG_ADMIN | update role/status + audit; chặn nếu là ORG_OWNER cuối | — |
| PATCH | `/users/me/profile` | User sở hữu | update user_profile + audit | `UserProfileUpdated` |

### 1.5 Business rule / invariant bắt buộc
- Tên/slug/domain của Organization không được trùng (unique index).
- Đúng một ORG_OWNER ACTIVE/organization (partial unique index trên `organization_member` where role=ORG_OWNER and status=ACTIVE).
- `PATCH members/:memberId` không được để Organization rơi vào trạng thái 0 ORG_OWNER.
- Mọi update dùng optimistic concurrency: `WHERE id = ? AND version = ?`, 0 row → `409 CONFLICT`.
- Idempotency-Key bắt buộc cho `POST /organizations` và `POST .../invitations` để chống double-submit.

### 1.6 Error code liên quan
`AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN`, `ORG_SLUG_TAKEN`, `ORG_DOMAIN_TAKEN`, `ORG_NOT_ACTIVE`, `ORG_LAST_OWNER_CANNOT_BE_REMOVED`, `ORG_VERIFICATION_ALREADY_PENDING`, `CONFLICT_VERSION_MISMATCH`.

### 1.7 Testing checklist
- Unit: permission policy (role × action bảng từ Phase 0) — 100% case pass.
- Unit: rule "đúng một ORG_OWNER active".
- Integration: constraint unique slug/domain trên PostgreSQL thật.
- Integration: idempotency-key replay trả về response gốc, không tạo bản ghi thứ hai.
- E2E (test 1 mục 13 architecture plan): Register organization → activate → invite member → member accept.

### 1.8 Rủi ro & lưu ý triển khai
- Không gán platform role AUTHOR/COMPANY — hai vai trò này xác định qua `author_profile`/`organization_member`, tránh lặp lỗi V4.
- Audit/outbox/idempotency phải xong ở Phase 1 vì Phase 2–6 sẽ tái sử dụng liên tục; nếu để trễ sẽ phải refactor lại toàn bộ module sau.

### 1.9 Definition of Done
- [ ] Đăng ký → xác minh → active → mời thành viên chạy end-to-end với transaction, audit, outbox đầy đủ.
- [ ] Test 1 (mục 13) pass trên môi trường CI.
- [ ] Không còn organization nào thiếu ORG_OWNER active trong dữ liệu test.

---

## Phase 2 — Author & Resource

### 2.1 Vị trí trong lộ trình
- **Phụ thuộc:** Phase 1 (user_account, organization đã có; Author verification không phụ thuộc tổ chức nhưng cần user_account).
- **Mở khóa:** Phase 3 (case cần Author VERIFIED để làm owner), Phase 5 (Author submit proposal, nhận case initiation).

### 2.2 Mục tiêu & phạm vi
Cho phép tác giả được xác minh danh tính và quản lý tài nguyên nghiên cứu (paper, dataset, model, source code, patent...) có version, có annotation, có kiểm soát truy cập. Bounded context: **Verification (Author)**, **Resource Catalog & Evidence**.

### 2.3 Breakdown theo nhóm công việc

**Sprint 2.1 — Author profile & verification**
1. Bảng `author_profile` (status: `UNVERIFIED → PENDING → VERIFIED`, `PENDING → DECLINED → PENDING`, `VERIFIED → SUSPENDED`).
2. Bảng `author_verification_request` + `verification_document` (private bucket, encryption at rest, signed URL ngắn hạn — **không** log URL/token đầy đủ).
3. `POST /author-verification-requests` — guard: không có request PENDING khác của cùng author.
4. `GET /review/author-verification-requests` (PLATFORM_REVIEWER) — danh sách hàng chờ duyệt.
5. `POST /review/author-verification-requests/:id/approve|reject` — cùng transaction: update request + author_profile + audit_log + outbox_event.
6. Guard: reviewer không được là chính applicant (chống tự duyệt).

**Sprint 2.2 — Resource core**
7. Bảng `resource` (owner org, resource_type, access_level, status).
8. Bảng `resource_version` (versioning thống nhất cho mọi loại resource — nguyên tắc: **không** để Paper tự chứa version như V4).
9. Bảng `paper_metadata` (subtype metadata theo loại resource — chỉ áp dụng khi resource_type=PAPER; các loại khác dataset/model/source_code/patent có metadata bảng riêng hoặc JSONB metadata theo mục 7.3).
10. `POST /resources` → tạo resource + resource_version đầu tiên trong cùng transaction.
11. `POST /resources/:id/versions` → thêm version mới (giữ version cũ, không overwrite).
12. Bảng `resource_ingestion_job` (status QUEUED/RUNNING/DONE/FAILED) — trigger khi tạo version.

**Sprint 2.3 — Ingestion pipeline (worker)**
13. Job: extract text từ file → chunk nội dung → lưu `resource_chunk`.
14. Job: sinh embedding cho từng chunk (phục vụ Phase 5 — recommendation & semantic retrieval).
15. Job retry cơ bản (retry đầy đủ với dead-letter để dành Phase 7).

**Sprint 2.4 — Annotation & Access control**
16. Bảng `annotation` gắn `resource_version` + bảng `annotation_revision`.
17. `POST /resource-versions/:id/annotations` → tạo annotation + annotation_revision đầu tiên.
18. Sửa annotation → luôn tạo `annotation_revision` mới, **không** cho phép tạo "PaperVersion giả" để né version thật (bài học từ V4).
19. Bảng `resource_access_grant` (grantee, resource/version, permission, expires_at) + `POST /resources/:id/access-grants`.
20. Kiểm tra MIME thực tế khi upload (không chỉ dựa vào extension) — chuẩn bị hook cho malware scan (hoàn thiện ở Phase 7).

### 2.4 Danh sách API/endpoint & transaction boundary

| Method | Path | Actor | Transaction boundary | Event |
|---|---|---|---|---|
| POST | `/author-verification-requests` | User | tạo request (guard: không trùng pending) | `AuthorVerificationSubmitted` |
| GET | `/review/author-verification-requests` | PLATFORM_REVIEWER | read-only | — |
| POST | `/review/author-verification-requests/:id/approve` | PLATFORM_REVIEWER | update request + author_profile=VERIFIED + audit + outbox | `AuthorVerified` |
| POST | `/review/author-verification-requests/:id/reject` | PLATFORM_REVIEWER | update request + author_profile=DECLINED + audit + outbox | `AuthorVerificationRejected` |
| POST | `/resources` | Author VERIFIED (hoặc Org member tùy chính sách) | tạo resource + resource_version v1 + trigger ingestion_job | `ResourceRegistered` |
| POST | `/resources/:id/versions` | Owner/Org member có quyền ghi | tạo resource_version mới + trigger ingestion_job | — |
| GET | `/resources/:id` | Actor có access_grant hoặc access_level phù hợp | read-only | — |
| POST | `/resources/:id/access-grants` | Owner/Org admin | tạo resource_access_grant + audit | — |
| POST | `/resource-versions/:id/annotations` | Actor có quyền đọc version | tạo annotation + annotation_revision v1 | — |
| PATCH | `/annotations/:id` | Tác giả annotation | tạo annotation_revision mới (không update in-place) | `AnnotationRevised` |

### 2.5 Business rule / invariant bắt buộc
- Không có `author_verification_request` PENDING trùng lặp cho cùng một author.
- File xác minh phải hợp lệ (MIME, kích thước) và lưu ở bucket private.
- Resource luôn có owner org, access_level và version đầu tiên ngay khi tạo — không tồn tại resource "rỗng" version.
- Sửa annotation **luôn** sinh revision mới; không được update field nội dung của revision cũ.
- Đọc resource/version phải qua kiểm tra `resource_access_grant` hoặc access_level công khai — áp dụng ngay từ Phase 2 dù RLS chưa bật (kiểm tra ở service layer).

### 2.6 Error code liên quan
`VERIFICATION_REQUEST_ALREADY_PENDING`, `VERIFICATION_DOCUMENT_INVALID`, `VERIFICATION_REVIEWER_IS_APPLICANT`, `RESOURCE_ACCESS_DENIED`, `RESOURCE_VERSION_NOT_FOUND`, `RESOURCE_INGESTION_FAILED`, `ANNOTATION_TARGET_NOT_FOUND`.

### 2.7 Testing checklist
- Unit: state machine `author_profile` (UNVERIFIED→PENDING→VERIFIED/DECLINED→PENDING→SUSPENDED).
- Unit: rule "annotation edit luôn tạo revision mới".
- Integration: transaction approve verification (request + profile + audit + outbox) rollback đúng khi 1 bước lỗi.
- Integration: resource_access_grant chặn được truy cập trái phép ở service layer.
- E2E (test 2 mục 13): Submit verification → approve → create Resource.
- Security: kiểm tra MIME thực tế thay vì tin extension (test upload file giả mạo).

### 2.8 Rủi ro & lưu ý triển khai
- Ingestion/chunk/embedding có thể chạy lâu — thiết kế job bất đồng bộ ngay từ đầu (đừng làm đồng bộ trong request tạo resource) để tránh phải refactor khi thêm resource lớn ở giai đoạn sau.
- Nguyên tắc "không dùng JSONB thay thế quan hệ nghiệp vụ quan trọng" áp dụng nghiêm ở annotation/resource_version — chỉ dùng JSONB cho metadata thay đổi theo loại resource (mục 7.3).

### 2.9 Definition of Done
- [ ] Một tác giả có thể được xác minh và đăng ký resource có version + annotation chạy end-to-end.
- [ ] Ingestion job và access control hoạt động, có test.
- [ ] Test 2 (mục 13) pass trên CI.

---

## Phase 3 — Technology Case & Evidence

### 3.1 Vị trí trong lộ trình
- **Phụ thuộc:** Phase 1 (organization ACTIVE), Phase 2 (Author VERIFIED, Resource/ResourceVersion tồn tại).
- **Mở khóa:** Phase 4 (assessment/gap/roadmap cần case tồn tại), Phase 5 (case có thể được tạo từ recommendation/proposal — nhưng logic tạo case dùng chung code Phase 3), Phase 6 (transfer gắn với case).

### 3.2 Mục tiêu & phạm vi
Hình thành Technology Case — trung tâm nghiệp vụ của toàn hệ thống — và liên kết bằng chứng (evidence) có trích dẫn (citation) rõ ràng. Bounded context: **Technology Case**, một phần **Resource Catalog & Evidence** (citation/evidence).

### 3.3 Breakdown theo nhóm công việc

**Sprint 3.1 — Case core & lifecycle**
1. Bảng `technology_case` (status theo lifecycle 10 bước: `DRAFT → EVIDENCE_COLLECTION → UNDER_ASSESSMENT → GAP_IDENTIFIED → ROADMAP_DRAFT → ROADMAP_APPROVED → PILOT_READY → TRANSFER_READY → COMMERCIALIZED → ARCHIVED`).
2. Bảng `technology_profile` (mô tả công nghệ, lĩnh vực, TRL ban đầu...).
3. Bảng `case_origin` (nguồn tạo: MANUAL / RECOMMENDATION / PROPOSAL, tham chiếu ngược tới recommendation_item hoặc research_proposal nếu có).
4. Bảng `case_status_history` — **mọi** lần chuyển trạng thái phải insert 1 row trong cùng transaction với thay đổi status.

**Sprint 3.2 — Case organization & member**
5. Bảng `case_organization` (owning org, partner org, reviewer org — role phân biệt rõ).
6. Bảng `case_member` (role ∈ {OWNER, TECHNICAL_MEMBER, CASE_REVIEWER, PARTNER_MEMBER, VIEWER}).
7. `POST /technology-cases` (manual): validate Author VERIFIED + Organization ACTIVE → tạo case + case_origin(MANUAL) + case_organization(owning) + case_member(OWNER) + case_status_history(DRAFT) — tất cả trong 1 transaction.
8. `POST /technology-cases/:id/members` — validate: PARTNER_MEMBER phải thuộc org đã có role PARTNER_COMPANY trong `case_organization`.
9. `POST /technology-cases/:id/organizations` — thêm partner/reviewer organization vào case.
10. `POST /technology-cases/:id/transitions` — endpoint chuyển trạng thái chung, validate theo state machine mục 5.6, ghi `case_status_history`.

**Sprint 3.3 — Evidence & Citation**
11. Bảng `citation` (resource_version_id, page/section/offset — locator rõ ràng, không dùng text tự do).
12. Bảng `evidence` + `evidence_citation` (bảng nối N-N evidence–citation).
13. `POST /technology-cases/:id/evidence` — chọn resource_version/annotation → kiểm tra `resource_access_grant` của actor → tạo citation → tạo evidence + evidence_citation, trong 1 transaction.
14. Guard: evidence ACTIVE bắt buộc có ít nhất 1 citation (constraint + application check).
15. Khi evidence đầu tiên được tạo → tự động transition case `DRAFT → EVIDENCE_COLLECTION` (qua endpoint transitions hoặc trigger nghiệp vụ trong service).

### 3.4 Danh sách API/endpoint & transaction boundary

| Method | Path | Actor | Transaction boundary | Event |
|---|---|---|---|---|
| POST | `/technology-cases` | Author VERIFIED / Org member | tạo case + origin(MANUAL) + owning org + OWNER member + status_history(DRAFT) | `TechnologyCaseCreated` |
| GET | `/technology-cases/:id` | Case member hoặc org liên quan | read-only, scope theo tenant | — |
| POST | `/technology-cases/:id/members` | OWNER/ORG_ADMIN | thêm case_member (validate PARTNER_MEMBER) + audit | — |
| POST | `/technology-cases/:id/organizations` | OWNER | thêm case_organization + audit | — |
| POST | `/technology-cases/:id/transitions` | tùy role theo transition | update status + case_status_history + audit + outbox | tùy transition |
| POST | `/technology-cases/:id/evidence` | Case member có quyền ghi | tạo citation + evidence + evidence_citation + (transition nếu là evidence đầu tiên) | `EvidenceLinked` |

### 3.5 Business rule / invariant bắt buộc
- Mỗi Technology Case có **đúng một** OWNER đang active.
- Case owner phải thuộc owning organization.
- PARTNER_MEMBER phải thuộc một organization đang có role PARTNER_COMPANY trong case đó — không cho thêm partner member từ tổ chức chưa được gắn vào case.
- Mọi transition status phải qua bảng state machine đã khóa ở Phase 0 (không cho nhảy state tùy ý, vd không thể DRAFT → ROADMAP_APPROVED trực tiếp).
- Evidence active luôn có ≥1 citation; citation phải có locator cụ thể (page/section/offset), không chấp nhận text tự do thay citation.
- **Chỉ OWNER/TECHNICAL_MEMBER/PARTNER_MEMBER được link evidence** — CASE_REVIEWER và
  VIEWER không được (chốt 2026-08-05, sau review Phase 3). Lý do: separation of duties —
  CASE_REVIEWER là người duyệt readiness assessment và roadmap ở Phase 4 (§4.4) dựa trên
  evidence đã link ở Phase 3; nếu CASE_REVIEWER cũng tự link được evidence, họ có thể tự
  đưa bằng chứng vào rồi tự duyệt dựa trên chính bằng chứng đó, phá vỡ mục đích của bước
  review độc lập. OWNER/TECHNICAL_MEMBER/PARTNER_MEMBER là người "làm" (đưa bằng chứng
  vào), CASE_REVIEWER thuần tuý là người "soát".

### 3.6 Error code liên quan
`CASE_OWNER_ALREADY_EXISTS`, `CASE_OWNER_NOT_IN_OWNING_ORG`, `CASE_PARTNER_MEMBER_ORG_NOT_LINKED`, `CASE_INVALID_TRANSITION`, `CASE_EVIDENCE_REQUIRES_CITATION`, `CASE_EVIDENCE_ROLE_NOT_ALLOWED`, `RESOURCE_ACCESS_DENIED`.

### 3.7 Testing checklist
- Unit: state machine Technology Case — test toàn bộ transition hợp lệ/không hợp lệ.
- Unit: rule "đúng một OWNER active".
- Integration: tạo evidence không có citation phải bị chặn (constraint + service check trùng nhau — test cả hai lớp).
- Integration: transaction tạo case rollback đúng nếu một bước (vd tạo case_member) lỗi.
- E2E: tạo case thủ công → mời member → link evidence → case chuyển EVIDENCE_COLLECTION.

### 3.8 Rủi ro & lưu ý triển khai
- Case là aggregate phức tạp nhất — nên viết integration test cho transaction boundary **trước** khi viết UI, vì đây là nơi dễ vỡ atomic nhất (owner + origin + organization + member + status_history phải cùng thành công/thất bại).
- Chuẩn bị sẵn endpoint `/technology-cases/:id/transitions` dùng chung cho cả tạo case thủ công (Phase 3) lẫn tạo case từ recommendation/proposal (Phase 5) để tránh viết trùng logic transition ở hai nơi.

### 3.9 Definition of Done
- [ ] Tạo case thủ công, gán thành viên, link evidence có citation hợp lệ, lịch sử trạng thái ghi nhận đầy đủ.
- [ ] Toàn bộ transition status đều đi qua state machine đã khóa, có test.
- [ ] Sẵn sàng cho Phase 4 (case ở EVIDENCE_COLLECTION có thể bắt đầu assessment).

---

## Phase 4 — Assessment, Gap, Roadmap

### 4.1 Vị trí trong lộ trình
- **Phụ thuộc:** Phase 3 (case ở trạng thái EVIDENCE_COLLECTION, có evidence/citation).
- **Mở khóa:** Phase 6 (transfer chỉ chuẩn bị được sau khi roadmap APPROVED và case tiến tới PILOT_READY/TRANSFER_READY).

### 4.2 Mục tiêu & phạm vi
Đánh giá mức độ sẵn sàng công nghệ (readiness assessment), xác định khoảng trống (gap) và lập lộ trình thương mại hóa (roadmap) có kiểm soát phụ thuộc — đây là phase có nhiều business rule phức tạp nhất (composite score, cycle detection, critical-gap gate).

### 4.3 Breakdown theo nhóm công việc

**Sprint 4.1 — Assessment framework (seed data)**
1. Bảng `assessment_framework` + `assessment_criterion` — rubric có version, seed ít nhất 1 framework mặc định qua migration riêng (`0004_v5_seed_framework.sql`, không gộp vào baseline).
2. Đảm bảo mỗi framework có version rõ ràng để case cũ vẫn tham chiếu đúng rubric đã dùng khi framework sau này cập nhật.

**Sprint 4.2 — Readiness Assessment**
3. `POST /technology-cases/:id/assessments` → tạo `readiness_assessment` (liên kết framework version hiện hành).
4. `PUT /assessments/:id/scores/:criterionId` → nhập/sửa `assessment_score` — bắt buộc kèm rationale + evidence + citation.
5. Validate: score nằm trong range hợp lệ của criterion; criterion phải thuộc đúng framework của assessment.
6. `POST /assessments/:id/submit` → tính composite score (công thức theo trọng số criterion) → chuyển case `UNDER_ASSESSMENT`.
7. `POST /assessments/:id/approve` → xác nhận assessment (reviewer) — chuẩn bị dữ liệu cho bước gap.

**Sprint 4.3 — Gap Analysis**
8. `POST /technology-cases/:id/gaps` → tạo `gap_record` (severity ∈ {LOW, MEDIUM, HIGH, CRITICAL}, status, owner, due_date).
9. Liên kết `gap_evidence`, `gap_citation`, `readiness_assessment` — gap phải có cơ sở (không tạo gap "cảm tính" không kèm evidence/citation).
10. Case tự động chuyển `GAP_IDENTIFIED` khi gap đầu tiên được ghi nhận sau assessment.
11. Workflow xử lý gap: owner cập nhật status (`OPEN → IN_PROGRESS → RESOLVED`), ghi resolution note.

**Sprint 4.4 — Roadmap**
12. `POST /technology-cases/:id/roadmaps` → tạo `roadmap` (version_no).
13. `POST /roadmaps/:id/milestones` → thêm `roadmap_milestone`.
14. Thêm `roadmap_task` cho từng milestone; thêm `milestone_dependency` (task/milestone phụ thuộc task/milestone khác).
15. Thêm `milestone_gap` — liên kết milestone với gap cần giải quyết trước khi hoàn thành milestone đó.
16. Cài thuật toán **phát hiện chu trình (cycle detection)** trên đồ thị `milestone_dependency` — chặn tạo/khóa nếu phát hiện cycle.
17. `POST /roadmaps/:id/submit` → chuyển `DRAFT → IN_REVIEW`, tạo `roadmap_review`.
18. `POST /roadmaps/:id/approve` → **chặn nếu còn gap CRITICAL chưa RESOLVED** liên kết tới roadmap này (qua `milestone_gap`) → nếu pass, roadmap `APPROVED`, case chuyển `ROADMAP_APPROVED`.

### 4.4 Danh sách API/endpoint & transaction boundary

| Method | Path | Actor | Transaction boundary | Event |
|---|---|---|---|---|
| POST | `/technology-cases/:id/assessments` | Case Technical Member | tạo readiness_assessment | — |
| PUT | `/assessments/:id/scores/:criterionId` | Case Technical Member | upsert assessment_score + evidence/citation link | — |
| POST | `/assessments/:id/submit` | Case Technical Member/Owner | validate scores + tính composite + case.status=UNDER_ASSESSMENT + audit | `AssessmentSubmitted` |
| POST | `/assessments/:id/approve` | Case Reviewer | update assessment status + audit + outbox | `AssessmentApproved` |
| POST | `/technology-cases/:id/gaps` | Case member | tạo gap_record + gap_evidence/citation + (transition nếu gap đầu tiên) | `GapCreated` (+ `CriticalGapCreated` nếu severity=CRITICAL) |
| POST | `/technology-cases/:id/roadmaps` | Case Owner | tạo roadmap version mới | — |
| POST | `/roadmaps/:id/milestones` | Case Owner | tạo milestone + task | — |
| POST | `/roadmaps/:id/submit` | Case Owner | status DRAFT→IN_REVIEW | — |
| POST | `/roadmaps/:id/approve` | Case Reviewer | validate no-critical-gap + no-cycle + status→APPROVED + case.status=ROADMAP_APPROVED + audit + outbox | `RoadmapApproved` |

### 4.5 Business rule / invariant bắt buộc
- Score phải nằm trong range hợp lệ của `assessment_criterion`; criterion phải thuộc đúng `assessment_framework` version đang dùng cho assessment đó.
- Mỗi `assessment_score` bắt buộc có rationale + evidence + citation — không cho submit assessment còn thiếu.
- Gap bắt buộc có severity, status, owner; gap phải có cơ sở support (assessment/evidence/citation).
- `milestone_dependency` không được tạo thành chu trình (DAG bắt buộc).
- **Không được approve roadmap khi còn gap CRITICAL ở trạng thái mở** (OPEN/IN_PROGRESS) liên kết qua `milestone_gap` — đây là gate nghiệp vụ quan trọng nhất của Phase 4.

### 4.6 Error code liên quan
`ASSESSMENT_SCORE_OUT_OF_RANGE`, `ASSESSMENT_CRITERION_FRAMEWORK_MISMATCH`, `ASSESSMENT_MISSING_EVIDENCE`, `GAP_SEVERITY_REQUIRED`, `GAP_MISSING_SUPPORT`, `ROADMAP_DEPENDENCY_CYCLE_DETECTED`, `ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS` (mã lỗi mẫu đã có sẵn trong mục 10 architecture plan).

### 4.7 Testing checklist
- Unit: công thức composite score với nhiều bộ trọng số khác nhau (đúng biên trên/dưới).
- Unit: cycle detection — test với đồ thị có/không có chu trình, kể cả chu trình gián tiếp qua nhiều node.
- Unit: rule "chặn approve khi còn CRITICAL gap mở" — test đủ 3 trạng thái gap OPEN/IN_PROGRESS/RESOLVED.
- Integration: transaction submit assessment (score + composite + status) rollback đúng khi thiếu evidence ở 1 score.
- E2E (test 4 mục 13): Link evidence → assess → create gaps → approve roadmap (bao gồm cả case approve thất bại do còn CRITICAL gap).

### 4.8 Rủi ro & lưu ý triển khai
- Cycle detection nên implement bằng thuật toán chuẩn (DFS với 3 màu, hoặc topological sort) và viết test riêng biệt, không lồng chung với logic tạo milestone để dễ maintain.
- Composite score formula cần chốt rõ ràng ở Phase 0/spec trước khi code — đây là điểm hay bị thay đổi giữa chừng, ảnh hưởng ngược tới toàn bộ assessment đã submit trước đó (cân nhắc versioning framework thay vì sửa formula tại chỗ).

### 4.9 Definition of Done
- [ ] Assessment có composite score đúng công thức, có unit test.
- [ ] Gap có đủ severity/owner, có workflow resolve.
- [ ] Roadmap không cycle và không approve được khi còn CRITICAL gap mở — có unit test cho từng rule.
- [ ] Test 4 (mục 13) pass trên CI.

---

## Phase 5 — Company & Discovery

### 5.1 Vị trí trong lộ trình
- **Phụ thuộc:** Phase 2 (Author VERIFIED để submit proposal/nhận case initiation), Phase 3 (logic tạo Technology Case dùng chung).
- **Mở khóa:** không chặn phase nào theo chiều thuận, nhưng case tạo ra từ Phase 5 sẽ tiếp tục vòng đời qua Phase 4 (assessment) và Phase 6 (transfer) như case tạo thủ công.
- **Có thể chạy song song với Phase 4** nếu đội đủ nguồn lực, miễn Phase 3 đã xong.

### 5.2 Mục tiêu & phạm vi
Kết nối phía doanh nghiệp (company) với tác giả/công nghệ thông qua nhu cầu nghiên cứu, đề xuất (proposal) và gợi ý AI (recommendation). Bounded context: **Company & Discovery**.

### 5.3 Breakdown theo nhóm công việc

**Sprint 5.1 — Company Profile**
1. Bảng `company_profile` — guard: Organization phải `type=ENTERPRISE` và `status=ACTIVE`.
2. `POST /organizations/:id/company-profile` (hoặc endpoint tương đương) → tạo company_profile.

**Sprint 5.2 — Research Need**
3. Bảng `research_need` (status: `DRAFT → OPEN → PAUSED → OPEN`, `OPEN → CLOSED → ARCHIVED`).
4. Bảng `need_statement_version` — input của need luôn có version, không update in-place.
5. `POST /research-needs` → tạo need DRAFT + statement version 1.
6. `POST /research-needs/:id/versions` → thêm statement version mới (khi cần chỉnh sửa nội dung need).
7. `POST /research-needs/:id/publish` → validate statement "đủ cụ thể" (application-layer check, không chỉ DB constraint) → chuyển OPEN.

**Sprint 5.3 — Research Proposal**
8. Bảng `research_proposal` — bám theo đúng `need_statement_version` tại thời điểm nộp (không tự động theo version mới nếu need bị sửa sau đó).
9. `POST /research-needs/:id/proposals` → validate need đang OPEN/PUBLIC + Author VERIFIED → tạo proposal DRAFT/SUBMITTED.
10. Luồng review nội bộ: `SUBMITTED → UNDER_REVIEW → ACCEPTED/REJECTED`; `SUBMITTED/UNDER_REVIEW → WITHDRAWN` (do author chủ động).
11. Accept proposal → tạo Technology Case (`case_origin=PROPOSAL`) tái sử dụng transaction Phase 3 (owner + organization + member + status_history) trong **cùng transaction** với update proposal.

**Sprint 5.4 — AI Recommendation**
12. Bảng `recommendation_run` (trạng thái PENDING/RUNNING/COMPLETED/FAILED).
13. `POST /research-needs/:id/recommendation-runs` → enqueue job cho worker.
14. Worker: dùng `resource_chunk`/embedding (Phase 2) để sinh `recommendation_item` kèm score + `recommendation_citation` liên kết `citation`/`resource_version`.
15. Guard: mỗi recommendation_item ACTIVE phải có ≥1 citation — item không đủ citation bị loại/không active hóa.
16. `GET /recommendation-runs/:id/items` → trả danh sách item kèm citation cho Company xem.

**Sprint 5.5 — Case Initiation từ Recommendation**
17. Bảng `case_initiation_request` (status: `PENDING → ACCEPTED/DECLINED/CANCELLED/EXPIRED`).
18. `POST /recommendation-items/:id/case-initiation-requests` → Company tạo request, cần **Author consent**.
19. Author accept → tạo Technology Case (`case_origin=RECOMMENDATION`, giữ nguyên recommendation_item/citation làm evidence ban đầu) — cùng transaction với update request.
20. Xử lý EXPIRED (job định kỳ hoặc TTL check khi đọc) cho request không được phản hồi.

### 5.4 Danh sách API/endpoint & transaction boundary

| Method | Path | Actor | Transaction boundary | Event |
|---|---|---|---|---|
| POST | `/research-needs` | Company Member | tạo need(DRAFT) + statement_version v1 | — |
| POST | `/research-needs/:id/versions` | Company Member | tạo statement_version mới | — |
| POST | `/research-needs/:id/publish` | Company Member | validate + status→OPEN | `ResearchNeedPublished` |
| POST | `/research-needs/:id/proposals` | Author VERIFIED | validate need OPEN + tạo proposal | `ProposalSubmitted` |
| POST | `/proposals/:id/accept` | Company Member | update proposal=ACCEPTED + tạo case(origin=PROPOSAL) + owner/member + history + notification | `ProposalAccepted`, `TechnologyCaseCreated` |
| POST | `/research-needs/:id/recommendation-runs` | Company Member | tạo run PENDING, enqueue job | `RecommendationRunRequested` |
| — (worker) | — | System | tạo recommendation_item + citation | `RecommendationRunCompleted` |
| GET | `/recommendation-runs/:id/items` | Company Member | read-only | — |
| POST | `/recommendation-items/:id/case-initiation-requests` | Company Member | tạo case_initiation_request(PENDING) + notification tới Author | `CaseInitiationRequested` |
| POST | `/case-initiation-requests/:id/accept` | Author (được yêu cầu) | update request=ACCEPTED + tạo case(origin=RECOMMENDATION) + giữ citation gốc + notification | `TechnologyCaseCreated` |
| POST | `/case-initiation-requests/:id/decline` | Author | update request=DECLINED + notification | — |

### 5.5 Business rule / invariant bắt buộc
- `company_profile` chỉ tạo được khi Organization `type=ENTERPRISE` và `ACTIVE`.
- Need chỉ nhận proposal khi đang `OPEN` (hoặc `PUBLIC` theo visibility field); Author phải `VERIFIED`.
- Proposal luôn bám `need_statement_version` cụ thể tại thời điểm nộp — sửa need sau đó không làm proposal cũ "lệch" ngữ cảnh.
- Mỗi `recommendation_item` ACTIVE bắt buộc có ≥1 citation.
- `case_initiation_request` bắt buộc có Author consent trước khi tạo case; giữ nguyên recommendation item/citation làm evidence ban đầu (không tạo evidence trùng lặp).
- Dù accept qua Proposal hay qua Case Initiation Request, case tạo ra vẫn phải tuân theo đúng 1 luồng transaction chuẩn của Phase 3 (đúng 1 OWNER, có case_organization, có status_history).

### 5.6 Error code liên quan
`DISCOVERY_ORG_NOT_ENTERPRISE`, `DISCOVERY_NEED_NOT_OPEN`, `DISCOVERY_AUTHOR_NOT_VERIFIED`, `DISCOVERY_PROPOSAL_STATE_INVALID`, `DISCOVERY_RECOMMENDATION_ITEM_MISSING_CITATION`, `DISCOVERY_INITIATION_REQUEST_EXPIRED`, `DISCOVERY_INITIATION_REQUEST_NOT_PENDING`.

### 5.7 Testing checklist
- Unit: state machine Research Need, Proposal, Case Initiation Request.
- Unit: rule "recommendation item active phải có citation".
- Integration: accept proposal / accept case initiation request → tạo case đúng transaction (rollback nếu 1 bước lỗi).
- Integration: worker recommendation chạy async, kiểm tra outbox event `RecommendationRunCompleted` được ghi đúng sau khi job xong.
- E2E (test 3 mục 13): Publish need → generate recommendation → initiate case → author accepts.
- E2E bổ sung: Submit proposal → accept proposal → tạo case (nhánh song song không qua recommendation).

### 5.8 Rủi ro & lưu ý triển khai
- Đây là phase phụ thuộc nhiều nhất vào chất lượng dữ liệu Phase 2 (resource_chunk/embedding) — nếu ingestion pipeline chưa đủ dữ liệu, recommendation sẽ trống hoặc kém chất lượng; nên có dữ liệu seed/demo resource trước khi test recommendation.
- Cần thống nhất rõ chính sách AI model/prompt (mục "Recommendation prompt/model policy" trong coverage matrix — thuộc application layer, không phải DB) trước khi code worker, tránh sửa đổi giữa chừng làm sai lệch citation đã sinh trước đó.
- Case tạo từ Proposal và từ Recommendation nên **dùng chung 1 service function** tạo case (khác nhau ở `case_origin` và nguồn evidence ban đầu) để tránh trùng lặp logic với Phase 3.

### 5.9 Definition of Done
- [ ] Luồng publish need → nhận proposal/recommendation → author consent → tạo case chạy end-to-end với đúng một owner và giữ được nguồn gốc (origin).
- [ ] Test 3 (mục 13) pass trên CI.
- [ ] Recommendation item luôn có citation hợp lệ khi active, có test kiểm tra.

---

## Phase 6 — Transfer & Moderation

### 6.1 Vị trí trong lộ trình
- **Phụ thuộc:** Phase 3 (case tồn tại), Phase 4 (roadmap APPROVED để case đủ điều kiện transfer — không bắt buộc cứng nhưng là điều kiện nghiệp vụ thông thường trước khi TRANSFER_READY).
- **Mở khóa:** Phase 7 (production hardening áp dụng lên toàn bộ, bao gồm transfer/moderation).

### 6.2 Mục tiêu & phạm vi
Đóng gói chuyển giao công nghệ có kiểm soát truy cập (transfer manifest), và vận hành kiểm duyệt nội dung (moderation) + thông báo (notification) cho toàn hệ thống. Bounded context: **Roadmap & Transfer** (phần Transfer), **Platform Operations** (moderation, notification).

### 6.3 Breakdown theo nhóm công việc

**Sprint 6.1 — Transfer Manifest**
1. Bảng `transfer_manifest` (status: `DRAFT → READY → SHARED → EXPIRED`, `SHARED → REVOKED`).
2. Bảng `transfer_manifest_item` — **chỉ** chứa manifest/metadata/location, không lưu file gốc (file gốc vẫn ở `resource`/`resource_version`).
3. Bảng `transfer_recipient`.
4. `POST /technology-cases/:id/transfer-manifests` → tạo manifest DRAFT.
5. `POST /transfer-manifests/:id/items` → thêm item (tham chiếu resource_version/evidence liên quan).
6. `POST /transfer-manifests/:id/recipients` → thêm recipient (user hoặc organization nhận).

**Sprint 6.2 — Share & Access Grant**
7. `POST /transfer-manifests/:id/share` → validate có ≥1 item và ≥1 recipient → chuyển `READY → SHARED` → tạo `resource_access_grant` cho từng recipient (expires_at bắt buộc) trong cùng transaction.
8. `POST /transfer-manifests/:id/revoke` → thu hồi access_grant liên quan + manifest → `REVOKED`.
9. Job định kỳ: quét manifest/grant quá `expires_at` → chuyển `EXPIRED`.

**Sprint 6.3 — Content Moderation**
10. Bảng `content_flag` — dùng FK tới các target được hỗ trợ (không dùng `content_type/content_id` kiểu polymorphic tự do như V4).
11. Bảng `moderation_decision`.
12. `POST /flags` (hoặc endpoint theo từng target) → tạo content_flag, validate chính xác một target.
13. `GET /review/flags` (PLATFORM_REVIEWER hoặc CASE_REVIEWER tùy target) → hàng chờ duyệt.
14. `POST /review/flags/:id/decide` → tạo moderation_decision + cập nhật moderation status của target + audit + outbox, trong 1 transaction.

**Sprint 6.4 — Notification**
15. Bảng `notification` (status UNREAD/READ) liên kết `outbox_event`.
16. Worker đọc `outbox_event` → tạo `notification` tương ứng cho user liên quan (dedupe theo event+user nếu cần).
17. `GET /notifications` / `POST /notifications/:id/read` — user chỉ đọc/đóng notification của chính mình.

### 6.4 Danh sách API/endpoint & transaction boundary

| Method | Path | Actor | Transaction boundary | Event |
|---|---|---|---|---|
| POST | `/technology-cases/:id/transfer-manifests` | Case Owner | tạo manifest(DRAFT) | — |
| POST | `/transfer-manifests/:id/items` | Case Owner | thêm item | — |
| POST | `/transfer-manifests/:id/recipients` | Case Owner | thêm recipient | — |
| POST | `/transfer-manifests/:id/share` | Case Owner | validate item/recipient + status→SHARED + tạo access_grant N recipient + outbox | `TransferManifestShared` |
| POST | `/transfer-manifests/:id/revoke` | Case Owner | thu hồi grant + status→REVOKED + audit | — |
| POST | `/flags` | Bất kỳ actor xác thực | tạo content_flag (validate 1 target) | `ContentFlagCreated` |
| GET | `/review/flags` | Platform/Case Reviewer | read-only | — |
| POST | `/review/flags/:id/decide` | Platform/Case Reviewer | tạo moderation_decision + update target status + audit + outbox | `ModerationDecisionRecorded` |
| GET | `/notifications` | User | read-only, scope theo user | — |
| POST | `/notifications/:id/read` | User sở hữu notification | update status=READ | `NotificationRead` |

### 6.5 Business rule / invariant bắt buộc
- Manifest chỉ `SHARE` được khi có ≥1 item và ≥1 recipient.
- Manifest **không bao giờ** chứa file gốc — chỉ metadata/location; file gốc luôn truy xuất qua `resource_access_grant` đã cấp.
- Mỗi access grant từ transfer phải có `expires_at`; hỗ trợ revoke thủ công trước hạn.
- `content_flag` phải trỏ **chính xác một** target hợp lệ (không cho flag rỗng hoặc nhiều target cùng lúc).
- User chỉ đọc/đóng được notification của chính mình; hệ thống cần dedupe được notification trùng lặp từ cùng một event.

### 6.6 Error code liên quan
`TRANSFER_MANIFEST_NO_ITEMS`, `TRANSFER_MANIFEST_NO_RECIPIENTS`, `TRANSFER_GRANT_EXPIRED`, `MODERATION_INVALID_TARGET`, `MODERATION_FLAG_ALREADY_RESOLVED`, `NOTIFICATION_NOT_OWNED`.

### 6.7 Testing checklist
- Unit: rule "manifest share yêu cầu ≥1 item + ≥1 recipient".
- Unit: rule "content_flag đúng 1 target".
- Integration: transaction share manifest tạo đúng N access_grant cho N recipient, rollback nếu 1 recipient lỗi.
- Integration: job expire manifest/grant chạy đúng theo `expires_at`.
- E2E (test 5 mục 13): Create transfer → grant access → revoke/expire.
- E2E (test 6 mục 13): Flag content → moderate → notify parties.

### 6.8 Rủi ro & lưu ý triển khai
- Vì transfer liên quan trực tiếp tới quyền truy cập tài nguyên nhạy cảm, nên viết security test (signed URL expiration, truy cập sau revoke) ngay trong Phase 6 thay vì để dồn hết sang Phase 7.
- Notification nên thiết kế idempotent theo `(event_id, user_id)` để worker retry (outbox) không tạo notification trùng.

### 6.9 Definition of Done
- [ ] Manifest share tạo grant có expiry/revoke; flag → moderation decision → notify chạy đúng transaction boundary (mục 7.5, use case 5 và 6).
- [ ] Test 5 và Test 6 (mục 13) pass trên CI.
- [ ] Access sau revoke/expire bị từ chối đúng như thiết kế (có test).

---

## Phase 7 — Production Hardening

### 7.1 Vị trí trong lộ trình
- **Phụ thuộc:** toàn bộ Phase 1–6 đã đạt DoD "implementation-ready" (mục 16 architecture plan).
- **Mở khóa:** go-live production.

### 7.2 Mục tiêu & phạm vi
Đưa hệ thống từ "implementation-ready" lên thực sự "production-ready" (mục 17). Không có use case nghiệp vụ mới — tập trung vào bảo mật, độ tin cậy và khả năng vận hành.

### 7.3 Breakdown theo nhóm công việc

**Sprint 7.1 — Data access security**
1. Viết integration test đầy đủ cho policy RBAC/ownership trước khi bật RLS (để không bị "khóa nhầm" dữ liệu hợp lệ).
2. Bật Row-Level Security cho các bảng tenant-critical (organization-scoped, case-scoped).
3. Test cross-tenant: user org A không đọc/ghi được dữ liệu org B kể cả khi bypass application layer.

**Sprint 7.2 — Reliability**
4. Cấu hình rate limit: login, verification upload, recommendation run, proposal submit.
5. Cấu hình retry + dead-letter queue cho toàn bộ background job (ingestion, embedding, recommendation, notification, transfer expiration).
6. Kiểm thử replay `Idempotency-Key` trên các endpoint quan trọng — đảm bảo không tạo bản ghi trùng.

**Sprint 7.3 — Observability**
7. Structured logging + request ID xuyên suốt (từ API → job → notification).
8. Metrics (latency, error rate, queue depth) + tracing phân tán giữa module.
9. Dashboard giám sát cơ bản cho các luồng quan trọng (case list, recommendation, notification).

**Sprint 7.4 — Backup, Restore, Load, Security**
10. Backup tự động (database + object storage) + diễn tập restore định kỳ, ghi nhận kết quả.
11. Load test cho dashboard, recommendation, case list — đối chiếu với mục tiêu hiệu năng đã định.
12. Security test: cross-tenant data access, broken object-level authorization, privilege escalation, replayed idempotent request, signed URL expiration.
13. Virus/malware scan thực tế cho file upload (hoàn thiện từ hook đã chuẩn bị ở Phase 2).

**Sprint 7.5 — Vận hành**
14. Quy trình incident response (escalation, runbook cơ bản cho các lỗi thường gặp: job stuck, RLS chặn nhầm, queue backlog).
15. Quy trình secret rotation định kỳ.

### 7.4 Danh sách hoạt động chính (không có endpoint nghiệp vụ mới)

| Hoạt động | Áp dụng lên | Kết quả cần đạt |
|---|---|---|
| Bật RLS | bảng tenant-critical | Chặn cross-tenant kể cả khi bypass service layer |
| Rate limiting | login, verification, recommendation, proposal | Không bị abuse/spam |
| Retry + DLQ | mọi background job | Job lỗi không mất, có nơi xử lý thủ công |
| Metrics/Tracing/Logging | toàn hệ thống | Có thể debug incident bằng request ID |
| Backup/Restore | database + object storage | Restore thành công trong diễn tập |
| Load test | dashboard, recommendation, case list | Đạt mục tiêu hiệu năng đã định |
| Security test | toàn hệ thống | Không còn lỗ hổng ở 5 nhóm test mục 13 |

### 7.5 Business rule / invariant bắt buộc
- RLS chỉ bật **sau khi** integration test policy đã hoàn chỉnh (không bật sớm khi policy chưa test kỹ — dễ gây false negative khó phát hiện).
- Mọi background job phải có chiến lược retry + dead-letter, không được để job lỗi âm thầm biến mất.
- Audit log không được sửa/xóa bởi user thông thường (chỉ append, có thể cần bảng riêng với quyền ghi hạn chế ở DB level).

### 7.6 Error code liên quan
Không phát sinh mã lỗi nghiệp vụ mới; tập trung vào mã lỗi hạ tầng (rate limit `429`, RLS deny tương đương `403`/`RESOURCE_ACCESS_DENIED`).

### 7.7 Testing checklist
- [ ] Cross-tenant data access — test âm tính (phải bị chặn).
- [ ] Broken object-level authorization (BOLA) trên toàn bộ endpoint có `:id`.
- [ ] Privilege escalation (user tự gán role cao hơn).
- [ ] Replayed idempotent request — không tạo dữ liệu trùng.
- [ ] Signed URL expiration — không truy cập được sau khi hết hạn.
- [ ] Backup/restore test thành công, có ghi log thời gian thực hiện.
- [ ] Load test đạt ngưỡng đã định cho dashboard/recommendation/case list.

### 7.8 Rủi ro & lưu ý triển khai
- Không được coi "code xong toàn bộ Phase 1–6" là production-ready — đây là hiểu lầm phổ biến nhất (đã ghi rõ trong README gói spec). Phase 7 là bắt buộc, không phải optional polish.
- Nên thực hiện Sprint 7.1 (RLS) sau cùng trong nhóm bảo mật, vì bật RLS quá sớm khi policy chưa chuẩn sẽ chặn nhầm rất nhiều luồng đang test ở Phase 1–6.

### 7.9 Definition of Done
Toàn bộ tiêu chí ở mục 17 (`Definition of "production-ready"`) của kiến trúc plan đạt, cụ thể:
- [ ] Cross-tenant authorization test đạt.
- [ ] Backup và restore test đạt.
- [ ] Migration rollback/forward strategy rõ ràng.
- [ ] Observability có logs, metrics, traces và request ID.
- [ ] Background jobs có retry, dead-letter và idempotency.
- [ ] File upload có validation và malware scanning.
- [ ] PII và verification documents có retention/encryption.
- [ ] Audit không thể bị sửa bởi user thông thường.
- [ ] Load test các luồng dashboard, recommendation và case list đạt mục tiêu đã định.
- [ ] Có quy trình incident response và secret rotation.

---

## Tổng hợp trình tự phase & phụ thuộc

```text
Phase 0  Spec Lock
   ↓
Phase 1  Platform Foundation        (Identity & Organization)
   ↓
Phase 2  Author & Resource          (Verification, Resource Catalog)
   ↓
Phase 3  Technology Case & Evidence (Technology Case)
   ↓                              ↘
Phase 4  Assessment, Gap, Roadmap    Phase 5  Company & Discovery
   ↓                              ↙   (phụ thuộc Phase 2 + Phase 3,
Phase 6  Transfer & Moderation        có thể chạy song song Phase 4)
   ↓
Phase 7  Production Hardening
```

**Bảng phụ thuộc nhanh:**

| Phase | Phụ thuộc cứng | Có thể song song với |
|---|---|---|
| 0 | — | — |
| 1 | Phase 0 | — |
| 2 | Phase 1 | — |
| 3 | Phase 1, Phase 2 | — |
| 4 | Phase 3 | Phase 5 |
| 5 | Phase 2, Phase 3 | Phase 4 |
| 6 | Phase 3 (và thường sau Phase 4 về mặt nghiệp vụ) | — |
| 7 | Phase 1–6 (toàn bộ) | — |

Ghi chú: Phase 5 tái sử dụng nguyên transaction tạo case của Phase 3 (chỉ khác `case_origin` và nguồn evidence ban đầu) — nên để cùng một nhóm dev phụ trách logic tạo case ở cả hai phase để tránh viết trùng/lệch nhau.
