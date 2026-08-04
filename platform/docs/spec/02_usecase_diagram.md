# R2M V5 — Sơ đồ Use Case

> Mermaid không có ký hiệu UML use-case chuẩn (actor que + hình ellipse), nên các sơ đồ dưới dùng
> flowchart: **actor** = hình chữ nhật bo góc `(Tên actor)`, **use case** = hình oval `([Tên use case])`,
> đường nối = mối quan hệ actor–use case. Mỗi bounded context là một subgraph, tương ứng 1 gói use case.
> Nguồn use case: `USE_CASE_COVERAGE_MATRIX.md` (20 use case).

## 0. Danh sách Actor (theo mô hình quyền 3 tầng, mục 4 kiến trúc plan)

| Actor | Loại quyền | Ghi chú |
|---|---|---|
| Guest/User | Platform role `USER` | Người dùng đã đăng nhập, chưa có role đặc biệt |
| Author (Unverified/Pending/Verified) | Profile, không phải platform role | Xác định qua `author_profile` |
| Org Owner / Org Admin | Organization role | `organization_member` |
| Company Member | Organization role trong org type ENTERPRISE | Dùng chung cơ chế `organization_member` |
| Case Owner / Technical Member / Case Reviewer / Partner Member / Viewer | Case role | `case_member` |
| Platform Reviewer | Platform role `PLATFORM_REVIEWER` | Duyệt xác minh, kiểm duyệt cấp nền tảng |
| Platform Admin | Platform role `PLATFORM_ADMIN` | Toàn quyền hệ thống |
| System / Worker | Actor kỹ thuật | Recommendation worker, notification worker, ingestion job |

---

## 1. Sơ đồ tổng thể (toàn bộ 20 use case theo 8 bounded context)

```mermaid
flowchart LR
  actorUser(("Guest / User"))
  actorAuthor(("Author"))
  actorOrgOwner(("Org Owner / Admin"))
  actorCompany(("Company Member"))
  actorCaseMember(("Case Member<br/>(Owner/Technical/Partner)"))
  actorReviewer(("Platform Reviewer"))
  actorAdmin(("Platform Admin"))
  actorSystem(("System / Worker"))

  subgraph SC1["Identity & Organization"]
    UC1(["UC1 Register Organization"])
    UC19(["UC19 Update Profile"])
  end

  subgraph SC2["Verification"]
    UC2(["UC2 Submit Identity Verification"])
    UC3(["UC3 Review Identity Verification"])
  end

  subgraph SC3["Resource Catalog & Evidence"]
    UC9(["UC9 Register Resource"])
    UC10(["UC10 Manage Author Annotations"])
  end

  subgraph SC4["Company & Discovery"]
    UC4(["UC4 Create Company Profile"])
    UC5(["UC5 Define Research Needs"])
    UC6(["UC6 Submit Research Proposal"])
    UC7(["UC7 View AI Recommendations"])
    UC8(["UC8 Initiate Case from Recommendation"])
  end

  subgraph SC5["Technology Case"]
    UC11(["UC11 Create Technology Case"])
    UC12(["UC12 Link Resource as Evidence"])
  end

  subgraph SC6["Readiness Assessment & Gap"]
    UC13(["UC13 Perform Readiness Assessment"])
    UC14(["UC14 Perform Gap Analysis"])
  end

  subgraph SC7["Roadmap & Transfer"]
    UC15(["UC15 Define Commercialization Roadmap"])
    UC16(["UC16 Prepare Transfer Package"])
  end

  subgraph SC8["Platform Operations"]
    UC17(["UC17 Handle Content Flagging"])
    UC18(["UC18 Manage Notifications"])
    UC20(["UC20 View Dashboard"])
  end

  actorUser --> UC1
  actorUser --> UC19
  actorUser --> UC17
  actorUser --> UC18
  actorUser --> UC20

  actorOrgOwner --> UC1
  actorOrgOwner --> UC4

  actorAuthor --> UC2
  actorAuthor --> UC9
  actorAuthor --> UC10
  actorAuthor --> UC6
  actorAuthor --> UC11
  actorAuthor --> UC8

  actorCompany --> UC4
  actorCompany --> UC5
  actorCompany --> UC7
  actorCompany --> UC8
  actorCompany --> UC11

  actorCaseMember --> UC12
  actorCaseMember --> UC13
  actorCaseMember --> UC14
  actorCaseMember --> UC15
  actorCaseMember --> UC16
  actorCaseMember --> UC20

  actorReviewer --> UC3
  actorReviewer --> UC17

  actorAdmin --> UC17
  actorAdmin --> UC3

  actorSystem --> UC7
  actorSystem --> UC18

  UC8 -. "include" .-> UC11
  UC6 -. "extend" .-> UC8
  UC12 -. "include" .-> UC13
  UC13 -. "include" .-> UC14
  UC14 -. "include" .-> UC15
  UC2 -. "precede" .-> UC3
```

---

## 2. Sơ đồ chi tiết theo từng bounded context

### 2.1 Identity & Organization + Verification

```mermaid
flowchart LR
  U(("User")) --> UC1(["UC1 Register Organization"])
  O(("Org Owner")) --> UC1
  R(("Platform Reviewer")) --> UC1r(["Review Org Verification"])
  U --> UC19(["UC19 Update Profile"])

  A(("Author")) --> UC2(["UC2 Submit Identity Verification"])
  R --> UC3(["UC3 Review Identity Verification"])

  UC1 -. "include" .-> UC1r
  UC2 -. "precede" .-> UC3
```

### 2.2 Resource Catalog & Evidence

```mermaid
flowchart LR
  A(("Author VERIFIED")) --> UC9(["UC9 Register Resource"])
  A --> UC10(["UC10 Manage Author Annotations"])
  CM(("Case Member")) --> UC12(["UC12 Link Resource as Evidence"])
  Sys(("System/Worker")) --> Ing(["Ingestion / Chunk / Embedding"])

  UC9 -. "include" .-> Ing
  UC12 -. "include" .-> UC9
```

### 2.3 Company & Discovery

```mermaid
flowchart LR
  C(("Company Member")) --> UC4(["UC4 Create Company Profile"])
  C --> UC5(["UC5 Define Research Needs"])
  A(("Author VERIFIED")) --> UC6(["UC6 Submit Research Proposal"])
  C --> UC7(["UC7 View AI Recommendations"])
  Sys(("System/Worker")) --> UC7
  C --> UC8(["UC8 Initiate Case from Recommendation"])
  A --> UC8con(["Author Consent"])

  UC6 -. "extend" .-> UC5
  UC7 -. "include" .-> UC5
  UC8 -. "include" .-> UC7
  UC8 -. "include" .-> UC8con
```

### 2.4 Technology Case

```mermaid
flowchart LR
  A(("Author VERIFIED")) --> UC11(["UC11 Create Technology Case"])
  C(("Company Member")) --> UC11
  C --> UC8(["UC8 Initiate Case from Recommendation"])
  CM(("Case Member")) --> UC12(["UC12 Link Resource as Evidence"])

  UC8 -. "include" .-> UC11
```

### 2.5 Readiness Assessment & Gap + Roadmap & Transfer

```mermaid
flowchart LR
  CM(("Case Member<br/>Technical/Reviewer")) --> UC13(["UC13 Perform Readiness Assessment"])
  CM --> UC14(["UC14 Perform Gap Analysis"])
  Owner(("Case Owner")) --> UC15(["UC15 Define Commercialization Roadmap"])
  Owner --> UC16(["UC16 Prepare Transfer Package"])

  UC13 -. "include" .-> UC14
  UC14 -. "include" .-> UC15
  UC15 -. "precede" .-> UC16
```

### 2.6 Platform Operations

```mermaid
flowchart LR
  U(("Any authenticated actor")) --> UC17(["UC17 Handle Content Flagging"])
  R(("Platform / Case Reviewer")) --> UC17
  U --> UC18(["UC18 Manage Notifications"])
  Sys(("System/Worker")) --> UC18
  U --> UC20(["UC20 View Dashboard"])
```

---

## 3. Ghi chú quan hệ include/extend

- `UC8 include UC11`: chấp nhận case initiation request luôn tạo Technology Case trong cùng transaction.
- `UC6 extend UC5`: nộp proposal mở rộng từ một Research Need đã publish.
- `UC12 include UC9`: link evidence yêu cầu resource/resource_version đã tồn tại và có access grant.
- `UC13 include UC14`, `UC14 include UC15`: assessment → gap → roadmap là chuỗi tuần tự bắt buộc theo lifecycle Technology Case (mục 5.6).
- `UC2 precede UC3`: submit verification luôn xảy ra trước review verification.
- `UC15 precede UC16`: roadmap phải APPROVED trước khi case đủ điều kiện chuẩn bị transfer.
