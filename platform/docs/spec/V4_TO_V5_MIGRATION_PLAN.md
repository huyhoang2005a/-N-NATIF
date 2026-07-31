# Migration Plan: V4 → V5

## Khuyến nghị quan trọng

Vì dự án đang ở giai đoạn spec/design và chưa có production data, phương án tối ưu là:

> **Không tiếp tục ALTER từng bảng V4. Tạo database/migration baseline V5 mới từ đầu.**

Việc cố giữ V4 sẽ tạo nhiều cột legacy, enum sai nghĩa và quan hệ một-một không đúng. Chỉ viết migration chuyển dữ liệu nếu đã có dữ liệu thật cần bảo toàn.

---

## 1. Mapping entity

| V4 | V5 | Hành động |
|---|---|---|
| `UserAccount.role` | `user_account.platform_role` + memberships | Không map AUTHOR/COMPANY_MEMBER thành platform role; tạo profile/membership tương ứng |
| `UserAccount.organization_id` | `organization_member` | Tạo membership ACTIVE cho user hiện có |
| `Organization.domain_whitelist` | `organization_domain` | Tách từng domain thành row |
| `VerificationStatus` | 3 status domain riêng | Chuyển theo ngữ cảnh, không dùng một enum chung |
| `VerificationRequest` | `author_verification_request` + `verification_document` | Chuyển URL tài liệu sang object key hoặc record migration tạm |
| `ResearchNeed` + `NeedStatement` | `research_need` + `need_statement_version` | NeedStatement hiện tại trở thành version 1 |
| `Resource` | `resource` | Đổi ID sang UUID; giữ owner org/type/access |
| `Paper` | `paper_metadata` | Paper không còn giữ content/version trực tiếp |
| `PaperVersion` | `resource_version` | Mỗi paper version trở thành resource version |
| `Annotation` | `annotation` + `annotation_revision` | Row hiện tại trở thành revision 1 |
| `Recommendation.recommendation_data` | `recommendation_run` + item + citation | Cần parse JSONB; record không parse được đưa vào migration quarantine |
| `CaseInitiationRequest` | `case_initiation_request` | Bổ sung requesting/target org và user |
| `TechnologyCase` | `technology_case` + origin/org/member/history | Tạo owning org, owner member và status history ban đầu |
| `CaseRole` | `case_member` | Map role string sang enum chính thức |
| `Evidence.citation_details` | `citation` + `evidence_citation` | Parse locator; dữ liệu không đủ đánh dấu `needs_review` trong script migration |
| `ReadinessAssessment` | assessment aggregate đầy đủ | Không thể tự động suy ra rubric/citation; cần migration có bước review |
| `GapRecord` | `gap_record` + links | Mặc định status OPEN nếu chưa có status |
| `RoadmapMilestone` | `roadmap` version 1 + milestone | Tạo một roadmap root cho mỗi case |
| `TransferManifest.metadata` | manifest/item/recipient | Parse JSONB; không giữ JSONB làm nguồn sự thật |
| `ContentFlag` | content flag + moderation decision | Map target_type/id vào FK hợp lệ |
| `Notification.is_read` | `notification.status` | false → UNREAD, true → READ |

---

## 2. Thứ tự migration nếu có dữ liệu cần giữ

1. Bật extension `pgcrypto`, `citext`, `vector`.
2. Tạo enum và bảng Identity/Organization.
3. Di chuyển user, profile, organization và membership.
4. Di chuyển author/company/verification.
5. Di chuyển resource, resource version, paper metadata và annotation.
6. Di chuyển research need/proposal/recommendation.
7. Di chuyển technology case, origin, org, member và history.
8. Di chuyển citation/evidence.
9. Di chuyển assessment/gap/roadmap.
10. Di chuyển transfer/moderation/notification.
11. Chạy consistency checks.
12. Chỉ sau khi đối chiếu xong mới xóa bảng V4.

---

## 3. Consistency checks bắt buộc

```text
Mọi user có organization_id cũ phải có organization_member mới.
Mọi case phải có đúng một active owner.
Mọi case phải có owning organization row.
Mọi resource phải có ít nhất một resource_version.
Mọi annotation phải có ít nhất một annotation_revision.
Mọi evidence active phải có citation.
Mọi recommendation item active phải có citation.
Mọi accepted initiation/proposal phải truy được Technology Case.
Mọi approved assessment phải có score/evidence/citation hợp lệ.
Mọi approved roadmap không có CRITICAL gap đang OPEN/IN_PROGRESS.
Mọi shared transfer có item và recipient.
```

---

## 4. Chiến lược migration trong repo

```text
packages/db/migrations/
  0001_v5_baseline.sql
  0002_v5_constraints.sql
  0003_v5_rls.sql
  0004_v5_seed_framework.sql
```

Không gộp dữ liệu seed nghiệp vụ vào baseline schema. Rubric mặc định phải có migration/seed riêng và version rõ ràng.

---

## 5. Khi nào được khóa V5

Chỉ khóa schema sau khi:

- Import DBML thành công.
- Migration chạy trên PostgreSQL trống.
- Migration chạy lại trong CI không tạo diff ngoài ý muốn.
- Seed framework thành công.
- 20 use case đều có coverage matrix.
- Các constraint test đều pass.
