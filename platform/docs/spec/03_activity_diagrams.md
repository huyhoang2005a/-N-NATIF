# R2M V5 — Activity Diagram theo từng Phase

> Ký hiệu: hình oval `([...])` = điểm bắt đầu/kết thúc, hình chữ nhật `[...]` = hoạt động,
> hình thoi `{...}` = quyết định (decision), subgraph = nhóm hoạt động theo actor (giả lập swimlane).
> Mỗi diagram tương ứng với workflow chính của phase đó trong `01_workflow_theo_phase.md`.

---

## Phase 0 — Spec Lock

```mermaid
flowchart TD
  Start(["Bắt đầu"]) --> A1[Khóa glossary]
  A1 --> A2[Viết state machine cho 8 lifecycle]
  A2 --> A3[Viết permission matrix 3 tầng]
  A3 --> A4[Viết API error catalog]
  A4 --> A5[Chốt schema V5: 59 bảng / 46 enum]
  A5 --> A6[Viết OpenAPI skeleton]
  A6 --> A7[Đối chiếu 20 use case với schema]
  A7 --> D1{Còn entity thiếu<br/>trong schema?}
  D1 -- "Có" --> A5
  D1 -- "Không" --> A8[Điền template use case<br/>đủ 15 mục cho mỗi UC]
  A8 --> D2{Mọi write use case<br/>đủ transaction/event/audit?}
  D2 -- "Chưa" --> A8
  D2 -- "Đủ" --> End(["Spec locked → sang Phase 1"])
```

---

## Phase 1 — Platform Foundation

```mermaid
flowchart TD
  Start(["Bắt đầu"]) --> subA
  subgraph subA["User / Org Owner"]
    B1[Đăng ký user_account] --> B2[Tạo Organization]
    B2 --> B3[Nộp Organization<br/>Verification Request]
  end
  subA --> subB
  subgraph subB["Platform Reviewer"]
    C1[Xem xét hồ sơ xác minh] --> C2{Đạt yêu cầu?}
  end
  C2 -- "Từ chối" --> R1[Organization = REJECTED] --> End1(["Kết thúc"])
  C2 -- "Duyệt" --> C3[Organization = ACTIVE]
  C3 --> C4[Gán ORG_OWNER<br/>cho user đăng ký]
  C4 --> subC
  subgraph subC["Org Owner"]
    D1[Mời thành viên<br/>invitation] --> D2["Ghi audit_log + outbox_event"]
  end
  subC --> subD
  subgraph subD["Member được mời"]
    E1[Nhận invitation] --> E2{Chấp nhận?}
  end
  E2 -- "Từ chối" --> End2(["Kết thúc"])
  E2 -- "Chấp nhận" --> E3[Tạo organization_member<br/>role = MEMBER/ORG_ADMIN]
  E3 --> End3(["Kết thúc — org có ≥1 member"])
```

---

## Phase 2 — Author & Resource

```mermaid
flowchart TD
  Start(["Bắt đầu"]) --> subA
  subgraph subA["Author"]
    A1[Tạo author_profile<br/>UNVERIFIED] --> A2[Nộp author_verification_request<br/>+ verification_document]
  end
  subA --> D1{Đã có request<br/>PENDING khác?}
  D1 -- "Có" --> ErrA[Từ chối: trùng request] --> EndA(["Kết thúc"])
  D1 -- "Không" --> A3[author_profile = PENDING]
  A3 --> subB
  subgraph subB["Platform Reviewer"]
    B1[Xem verification_document<br/>qua signed URL] --> B2{Approve?}
  end
  B2 -- "Reject" --> B3[author_profile = DECLINED] --> subC1
  B2 -- "Approve" --> B4["author_profile = VERIFIED<br/>(cùng transaction: request + profile + audit + outbox)"]
  subgraph subC1["Author"]
    C1a[Nhận notification]
  end
  B3 --> subC1
  B4 --> subC1
  B4 --> subD
  subgraph subD["Author VERIFIED"]
    D2[Đăng ký resource<br/>UC9] --> D3[Tạo resource_version đầu tiên]
    D3 --> D4["Trigger resource_ingestion_job"]
  end
  subD --> subE
  subgraph subE["System / Worker"]
    E1[Extract text] --> E2[Chunk + Embedding]
  end
  subE --> subF
  subgraph subF["Author / Reader có quyền"]
    F1[Tạo annotation<br/>trên resource_version] --> F2{Sửa annotation?}
    F2 -- "Có" --> F3[Tạo annotation_revision mới]
    F2 -- "Không" --> End(["Kết thúc"])
    F3 --> End
  end
```

---

## Phase 3 — Technology Case & Evidence

```mermaid
flowchart TD
  Start(["Bắt đầu"]) --> D1{Author VERIFIED<br/>và Organization ACTIVE?}
  D1 -- "Không" --> ErrA[Từ chối tạo case] --> EndA(["Kết thúc"])
  D1 -- "Có" --> subA
  subgraph subA["Author / Company"]
    A1[Tạo technology_case<br/>UC11] --> A2["Tạo case_origin = MANUAL"]
    A2 --> A3[Gán case_member<br/>role = OWNER]
    A3 --> A4["case_status_history: DRAFT"]
  end
  subA --> subB
  subgraph subB["Case Owner"]
    B1[Mời Technical Member /<br/>Partner Member / Reviewer]
  end
  subB --> subC
  subgraph subC["Case Member"]
    C1[Chọn resource_version /<br/>annotation làm bằng chứng] --> C2{Có resource_access_grant?}
  end
  C2 -- "Không" --> ErrB[Từ chối: không có quyền đọc] --> EndB(["Kết thúc"])
  C2 -- "Có" --> C3["Tạo citation (page/section/offset)"]
  C3 --> C4[Tạo evidence + evidence_citation<br/>UC12]
  C4 --> C5["case_status: DRAFT → EVIDENCE_COLLECTION"]
  C5 --> End(["Kết thúc — sang Phase 4"])
```

---

## Phase 4 — Assessment, Gap, Roadmap

```mermaid
flowchart TD
  Start(["Bắt đầu — case ở EVIDENCE_COLLECTION"]) --> subA
  subgraph subA["Case Member (Technical/Reviewer)"]
    A1[Chọn assessment_framework] --> A2[Tạo readiness_assessment]
    A2 --> A3["Nhập assessment_score<br/>cho từng criterion"]
  end
  subA --> D1{"Mỗi score có<br/>evidence + citation?"}
  D1 -- "Thiếu" --> A3
  D1 -- "Đủ" --> A4[Submit assessment]
  A4 --> A5[Tính composite score]
  A5 --> A6["case_status: UNDER_ASSESSMENT"]
  A6 --> subB
  subgraph subB["Case Member"]
    B1["Tạo gap_record<br/>severity/status/owner/due date"] --> B2[Liên kết gap_evidence /<br/>gap_citation / readiness_assessment]
  end
  B2 --> B3["case_status: GAP_IDENTIFIED"]
  B3 --> subC
  subgraph subC["Case Owner"]
    C1["Tạo roadmap (version)"] --> C2[Thêm roadmap_milestone]
    C2 --> C3[Thêm roadmap_task]
    C3 --> C4[Thêm milestone_dependency]
    C4 --> C5[Liên kết milestone_gap]
  end
  C5 --> D2{Có circular<br/>dependency?}
  D2 -- "Có" --> ErrA[Từ chối: sửa dependency] --> C4
  D2 -- "Không" --> C6[Submit roadmap → IN_REVIEW]
  C6 --> subD
  subgraph subD["Reviewer"]
    D3["Tạo roadmap_review"]
  end
  D3 --> D4{Còn CRITICAL gap<br/>chưa resolve?}
  D4 -- "Có" --> ErrB["Chặn approve<br/>ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS"] --> EndErr(["Kết thúc — cần xử lý gap"])
  D4 -- "Không" --> D5["roadmap = APPROVED"]
  D5 --> D6["case_status: ROADMAP_DRAFT → ROADMAP_APPROVED"]
  D6 --> End(["Kết thúc — sang Phase 6 (Transfer)"])
```

---

## Phase 5 — Company & Discovery

```mermaid
flowchart TD
  Start(["Bắt đầu"]) --> D0{"Organization type<br/>= ENTERPRISE và ACTIVE?"}
  D0 -- "Không" --> ErrA[Từ chối tạo company_profile] --> EndA(["Kết thúc"])
  D0 -- "Có" --> subA
  subgraph subA["Company Member"]
    A1["Tạo company_profile (UC4)"] --> A2["Tạo research_need = DRAFT (UC5)"]
    A2 --> A3[Tạo need_statement_version]
    A3 --> A4{"Statement đủ cụ thể?"}
  end
  A4 -- "Không" --> A3
  A4 -- "Có" --> A5["Publish → research_need = OPEN"]
  A5 --> subB
  subgraph subB["Author VERIFIED"]
    B1{"Need đang OPEN/PUBLIC<br/>và Author VERIFIED?"}
    B1 -- "Có" --> B2["Nộp research_proposal (UC6)<br/>bám need_statement_version"]
  end
  B1 -- "Không" --> ErrB[Từ chối nộp proposal] --> EndB(["Kết thúc"])
  A5 --> subC
  subgraph subC["Company / System"]
    C1["Khởi chạy recommendation_run (UC7)"] --> C2["Worker sinh recommendation_item<br/>+ recommendation_citation"]
  end
  C2 --> D1{"Mỗi item active<br/>có ≥1 citation?"}
  D1 -- "Không" --> ErrC[Loại item không hợp lệ] --> C2
  D1 -- "Có" --> C3["RecommendationRunCompleted"]
  C3 --> subD
  subgraph subD["Company Member"]
    D2[Xem danh sách recommendation] --> D3["Chọn item → tạo case_initiation_request (UC8)"]
  end
  D3 --> subE
  subgraph subE["Author"]
    E1{"Author đồng ý (consent)?"}
  end
  E1 -- "Từ chối" --> E2["case_initiation_request = DECLINED"] --> EndC(["Kết thúc"])
  E1 -- "Đồng ý" --> E3["case_initiation_request = ACCEPTED"]
  E3 --> E4["Tạo technology_case<br/>case_origin = RECOMMENDATION<br/>(giữ nguyên item/citation)"]
  E4 --> End(["Kết thúc — case sang Phase 3/4"])

  B2 -.->|"Company có thể Accept<br/>Proposal trực tiếp"| F1["Tạo technology_case<br/>case_origin = PROPOSAL"]
  F1 --> End
```

---

## Phase 6 — Transfer & Moderation

```mermaid
flowchart TD
  Start(["Bắt đầu — case đủ điều kiện transfer"]) --> subA
  subgraph subA["Case Owner"]
    A1["Tạo transfer_manifest = DRAFT (UC16)"] --> A2[Thêm transfer_manifest_item<br/>chỉ metadata/location]
    A2 --> A3[Thêm transfer_recipient]
  end
  A3 --> D1{"Có ≥1 item<br/>và ≥1 recipient?"}
  D1 -- "Không" --> A2
  D1 -- "Có" --> A4["manifest = READY"]
  A4 --> A5["Share → manifest = SHARED"]
  A5 --> A6["Tạo resource_access_grant<br/>cho từng recipient (có expiry)"]
  A6 --> D2{Owner revoke<br/>hay hết hạn?}
  D2 -- "Revoke" --> A7["grant/manifest = REVOKED"] --> End1(["Kết thúc"])
  D2 -- "Hết hạn" --> A8["manifest = EXPIRED"] --> End1

  Start2(["Song song: bất kỳ actor"]) --> subB
  subgraph subB["Actor bất kỳ"]
    B1["Tạo content_flag (UC17)<br/>trên đúng 1 target"]
  end
  B1 --> subC
  subgraph subC["Platform / Case Reviewer"]
    C1[Xem xét content_flag] --> C2{Quyết định}
  end
  C2 -- "Vi phạm" --> C3["Tạo moderation_decision<br/>cập nhật target moderation status"]
  C2 -- "Không vi phạm" --> C4["Tạo moderation_decision = DISMISSED"]
  C3 --> subD
  C4 --> subD
  subgraph subD["System"]
    D3["Tạo notification cho các bên liên quan (UC18)"]
  end
  D3 --> subE
  subgraph subE["User nhận thông báo"]
    E1["Đọc / đóng notification<br/>(chỉ notification của chính mình)"]
  end
  E1 --> End2(["Kết thúc"])
```

---

## Phase 7 — Production Hardening

```mermaid
flowchart TD
  Start(["Bắt đầu — hệ thống đã implementation-ready"]) --> A1[Hoàn tất integration test<br/>cho toàn bộ policy]
  A1 --> A2["Bật Row-Level Security (RLS)<br/>cho bảng tenant-critical"]
  A2 --> A3["Cấu hình rate limit<br/>login/verification/recommendation/proposal"]
  A3 --> A4["Cấu hình retry + dead-letter queue<br/>cho background job"]
  A4 --> A5["Thiết lập metrics / tracing / logging<br/>+ request ID"]
  A5 --> A6["Thiết lập backup tự động"]
  A6 --> A7["Diễn tập restore"]
  A7 --> D1{Restore thành công?}
  D1 -- "Không" --> A6
  D1 -- "Có" --> A8["Chạy load test:<br/>dashboard / recommendation / case list"]
  A8 --> D2{Đạt mục tiêu hiệu năng?}
  D2 -- "Không" --> A8
  D2 -- "Có" --> A9["Chạy security test:<br/>cross-tenant, BOLA, privilege escalation,<br/>replay idempotent, signed URL expiry"]
  A9 --> D3{Đạt yêu cầu bảo mật?}
  D3 -- "Không" --> A9
  D3 -- "Có" --> A10["Thiết lập incident response<br/>+ secret rotation"]
  A10 --> End(["Hệ thống production-ready"])
```
