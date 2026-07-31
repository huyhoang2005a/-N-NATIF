# V5 Use Case Coverage Matrix

## Cách đọc

- **Aggregate**: entity gốc bị thay đổi.
- **Supporting entities**: dữ liệu phụ trợ bắt buộc.
- **Atomic transaction**: các thay đổi phải thành công hoặc rollback cùng nhau.
- **Event**: event được ghi vào outbox sau khi transaction thành công.

| # | Use case | Aggregate chính | Supporting entities | Invariant quan trọng | Event chính | Độ phủ V5 |
|---:|---|---|---|---|---|---:|
| 1 | Register Organization | `organization` | `user_account`, `organization_domain`, `organization_member`, `organization_verification_request` | Tên/slug/domain không trùng; tạo đúng một ORG_OWNER | `OrganizationRegistered` | 100% |
| 2 | Submit Identity Verification | `author_verification_request` | `author_profile`, `verification_document`, `notification`, `audit_log` | Không có request pending khác; file hợp lệ và private | `AuthorVerificationSubmitted` | 100% |
| 3 | Review Identity Verification | `author_verification_request` | `author_profile`, `notification`, `audit_log`, `outbox_event` | Reviewer không phải applicant; approve cập nhật profile trong cùng transaction | `AuthorVerified` / `AuthorVerificationRejected` | 100% |
| 4 | Create Company Profile | `company_profile` | `organization`, `organization_member` | Organization phải ACTIVE và type ENTERPRISE | `CompanyProfileCreated` | 100% |
| 5 | Define Research Needs | `research_need` | `need_statement_version` | Input có version; publish chỉ khi statement hợp lệ | `ResearchNeedPublished` | 100% |
| 6 | Submit Research Proposal | `research_proposal` | `research_need`, `need_statement_version`, `author_profile`, `notification` | Need OPEN/PUBLIC; Author VERIFIED; proposal bám đúng statement version | `ProposalSubmitted` | 100% |
| 7 | View AI Recommendations | `recommendation_run` | `recommendation_item`, `recommendation_citation`, `citation`, `resource_version`, `resource_chunk` | Mỗi item active có ít nhất một citation | `RecommendationRunCompleted` | 100% |
| 8 | Initiate Case from Recommendation | `case_initiation_request` | `technology_case`, `case_origin`, `case_organization`, `case_member`, `case_status_history` | Author consent; giữ recommendation item/citation; một case owner | `TechnologyCaseCreated` | 100% |
| 9 | Register Resource | `resource` | `resource_version`, `paper_metadata`, `resource_ingestion_job`, `audit_log` | Resource có owner org, access level và version đầu tiên | `ResourceRegistered` | 100% |
| 10 | Manage Author Annotations | `annotation` | `annotation_revision`, `resource_version`, `audit_log` | Annotation sửa tạo revision mới; không tạo PaperVersion giả | `AnnotationRevised` | 100% |
| 11 | Create Technology Case | `technology_case` | `case_origin`, `case_organization`, `case_member`, `case_status_history`, `technology_profile` | Author VERIFIED; org ACTIVE; đúng một OWNER | `TechnologyCaseCreated` | 100% |
| 12 | Link Resource as Evidence | `evidence` | `citation`, `evidence_citation`, `annotation`, `resource_access_grant` | Evidence active phải có citation; user có quyền đọc resource | `EvidenceLinked` | 100% |
| 13 | Perform Readiness Assessment | `readiness_assessment` | `assessment_framework`, `assessment_criterion`, `assessment_score`, score-evidence/citation | Score trong range; criterion đúng framework; citation/evidence bắt buộc | `AssessmentSubmitted` | 100% |
| 14 | Perform Gap Analysis | `gap_record` | `gap_evidence`, `gap_citation`, `readiness_assessment` | Severity bắt buộc; có assessment/evidence/citation support | `GapCreated` | 100% |
| 15 | Define Commercialization Roadmap | `roadmap` | `roadmap_milestone`, `roadmap_task`, `milestone_dependency`, `milestone_gap`, `roadmap_review` | Không cycle; không approve khi còn CRITICAL gap mở | `RoadmapApproved` | 100% |
| 16 | Prepare Transfer Package | `transfer_manifest` | `transfer_manifest_item`, `transfer_recipient`, `resource_access_grant` | Có item + recipient; không chứa file gốc; grant có expiry/revoke | `TransferManifestShared` | 100% |
| 17 | Handle Content Flagging | `content_flag` | `moderation_decision`, target moderation status, `notification`, `audit_log` | Chính xác một target; reviewer decision bắt buộc | `ModerationDecisionRecorded` | 100% |
| 18 | Manage Notifications | `notification` | `outbox_event` | User chỉ đọc/đóng notification của mình; dedupe được | `NotificationRead` | 100% |
| 19 | Update Profile | `user_profile` | `user_account`, `audit_log` | Email đổi đi qua identity/email verification flow | `UserProfileUpdated` | 100% |
| 20 | View Dashboard | Read model | `notification`, case/need/proposal/verification projections | Scope theo user + organization; không query chéo tenant | Không bắt buộc | 95% |

## Entity không nên thêm vào schema giao dịch

`DashboardData` không phải bảng nguồn. Dashboard nên là **read model** được tính từ:

- query tối ưu;
- materialized view;
- hoặc projection/cache được cập nhật bằng outbox event.

Không tạo một bảng `dashboard_data` chung rồi ghi đè thủ công, vì dữ liệu sẽ dễ lệch khỏi nguồn sự thật.

## Các kiểm tra còn thuộc application layer

Một số invariant không nên chỉ dựa vào database:

1. Resource URL có thực sự hợp lệ và được phép truy cập.
2. MIME/file malware validation.
3. Need statement có “đủ cụ thể” hay không.
4. Người dùng có quyền nghiệp vụ cụ thể trong case.
5. State transition hợp lệ theo workflow.
6. Recommendation prompt/model policy.
7. Signed URL và expiration.
8. Dashboard cache invalidation.

Database là lớp phòng vệ cuối, không thay thế domain policy.
