# Quy trình làm việc dự án IMS

> Tài liệu nội bộ: ai làm gì, xong thì bàn giao cho ai, bàn giao bằng gì.
> Một người (Trần Việt Anh) đảm nhận 5 vai trò **PM, BA, FE, BE, TEST**. "Bàn giao" ở đây nghĩa là
> **đổi vai trò** (đổi mũ) một cách có kỷ luật: đóng việc của vai trò trước bằng đầu ra rõ ràng, chuyển trạng
> thái trên Jira và để lại comment bàn giao, rồi mới bắt đầu việc của vai trò sau.
>
> Jira space key: **IM** · Board: **IMS board** · Sprint: **IMS Sprint 0..5** · Repo: `tranvietanh0/QLDAPM`

## Mục lục
1. [Nguyên tắc chung](#1-nguyên-tắc-chung)
2. [Vai trò và đầu ra](#2-vai-trò-và-đầu-ra)
3. [Trạng thái trên Jira và ai được chuyển](#3-trạng-thái-trên-jira-và-ai-được-chuyển)
4. [Chuỗi bàn giao tổng quát](#4-chuỗi-bàn-giao-tổng-quát)
5. [Vòng đời một User Story trong Sprint](#5-vòng-đời-một-user-story-trong-sprint)
6. [Quy trình xử lý Bug](#6-quy-trình-xử-lý-bug)
7. [Nhịp làm việc: ngày, tuần, Sprint](#7-nhịp-làm-việc-ngày-tuần-sprint)
8. [Git và liên kết Jira](#8-git-và-liên-kết-jira)
9. [Definition of Ready và Definition of Done](#9-definition-of-ready-và-definition-of-done)
10. [Mẫu comment bàn giao](#10-mẫu-comment-bàn-giao)
11. [Quản lý thay đổi (Change Request)](#11-quản-lý-thay-đổi-change-request)
12. [Bảng bàn giao chi tiết theo từng việc](#12-bảng-bàn-giao-chi-tiết-theo-từng-việc)

---

## 1. Nguyên tắc chung

| # | Nguyên tắc | Lý do |
|---|---|---|
| 1 | Mỗi việc có **đúng một vai trò chịu trách nhiệm** (label `PM/BA/FE/BE/TEST`, tiền tố `[BE]` trong summary) | Biết đang đội mũ nào, tiêu chí nào |
| 2 | **Không bắt đầu việc khi việc phụ thuộc chưa Done** (mục "PHỤ THUỘC" trong Description) | Tránh làm lại |
| 3 | Mỗi lần bàn giao phải có **đầu ra kiểm tra được** + **comment bàn giao** (mục 10) | Lưu vết cho báo cáo môn học |
| 4 | **Người viết code không tự đóng Story**: BE/FE → BA nghiệm thu → TEST kiểm thử → PM đóng | Giảm thiên kiến khi một người làm tất cả |
| 5 | **WIP tối đa 2** việc ở cột In Progress | Chống quá tải (rủi ro R-01) |
| 6 | Việc trên **đường găng** (Priority High, "ĐƯỜNG GĂNG" trong Description) được ưu tiên trước | Trễ là trễ cả dự án |
| 7 | Mọi thay đổi phạm vi sau mốc M1 đi qua **Change Request** | Kiểm soát scope creep (R-03) |

## 2. Vai trò và đầu ra

| Vai trò | Nhận đầu vào từ | Làm | Bàn giao đầu ra cho |
|---|---|---|---|
| **PM** | Giảng viên (yêu cầu đề tài), TEST (kết quả test), BA (backlog đã refine) | Kế hoạch, Sprint Planning, theo dõi, rủi ro, báo cáo | BA (phạm vi, kế hoạch), mọi vai trò (Sprint backlog) |
| **BA** | PM (scope), người dùng (khảo sát) | SRS, Use Case, User Story, AC, RTM, nghiệm thu nội bộ | FE/BE (AC đã chốt), TEST (AC để viết test case), PM (backlog sẵn sàng) |
| **FE** | BA (AC, sitemap), BE (API đã chạy + Swagger) | Wireframe, màn hình React | BA (màn hình để nghiệm thu) |
| **BE** | BA (FR, BR, AC), thiết kế ERD/API | CSDL, API, bảo mật, hạ tầng | FE (API + Swagger), TEST (endpoint để test Postman) |
| **TEST** | BA (AC), BE/FE (build đã qua nghiệm thu) | Test Plan, test case, chạy test, ghi Bug | BE/FE (Bug), PM (kết quả test để đóng Story) |

## 3. Trạng thái trên Jira và ai được chuyển

```
 To Do ──► In Progress ──► In Testing ──► Done
             ▲    (BE/FE)       │  (TEST)     (PM đóng Story sau khi TEST pass)
             └──── trả lại ─────┘  (TEST tạo Bug hoặc BA không nghiệm thu)
```

| Chuyển trạng thái | Ai thực hiện | Điều kiện |
|---|---|---|
| To Do → In Progress | Vai trò sở hữu việc | Việc phụ thuộc đã Done; WIP < 2 |
| In Progress → In Testing | BE/FE (Sub-task), BA (Story sau nghiệm thu) | Đạt DoD phía dev, PR đã merge vào `develop`, comment bàn giao |
| In Testing → Done | TEST (Sub-task/Task), PM (Story) | Test case liên quan đạt, không còn Bug S1/S2 mở |
| In Testing → In Progress | TEST hoặc BA | Có Bug hoặc không đạt AC; ghi rõ lý do |
| Task PM/BA không cần test | Chính vai trò đó | To Do → In Progress → Done khi đạt DoD |

## 4. Chuỗi bàn giao tổng quát

```
Sprint 0 (khởi động & thiết kế)
  PM: Charter → Scope → WBS/Gantt ─┐
                                   ▼
  BA: Khảo sát → SRS (FR/NFR/BR) → Use Case → User Story + AC → RTM
                                   │                         │
                                   ▼                         ▼
  FE: Sitemap → Wireframe      BE: Kiến trúc → ERD → OpenAPI   TEST: Test Plan (Sprint 1)
                                   │
  PM: Design Baseline (M1) ◄───────┘

Sprint 1..4 (mỗi Sprint lặp lại)
  BA chốt AC (x.1) ──► BE làm API ──► FE làm màn hình ──► BA nghiệm thu nội bộ
        │                                                        │
        └──► TEST viết test case                                 ▼
                                         TEST chạy test case (x.11) ──► PM Sprint Review/đóng Story
                                                  │
                                                  └──► Bug ──► BE/FE sửa ──► TEST verify
  BA refine backlog Sprint sau (x.12) ──► PM Sprint Planning Sprint sau

Sprint 5 (ổn định & phát hành)
  TEST hồi quy ──► BE/FE sửa bug S1/S2 ──► BE release v1.0.0 + môi trường UAT
      ──► BA điều phối UAT ──► TEST ghi lỗi UAT ──► BA UAT Sign-off ──► PM nghiệm thu (M6)
```

## 5. Vòng đời một User Story trong Sprint

Ví dụ **US-01 Đăng nhập** (Sprint 1). Mọi Story khác đi đúng các bước này.

| Bước | Vai trò | Việc (WBS) | Trạng thái Jira | Bàn giao cho | Bằng gì |
|---|---|---|---|---|---|
| 1 | PM | Sprint Planning (1.8) | Story vào IMS Sprint 1 | BA | Sprint Goal, Story được chọn |
| 2 | BA | Chốt AC (5.1) | Task 5.1 → Done | BE, FE, TEST | AC Given-When-Then trong Story, ma trận quyền |
| 3 | TEST | Viết test case từ AC (9.2) | Task 9.2 In Progress | (chờ build) | TC-AUTH-01..04 |
| 4 | BE | API login (5.2) | Sub-task → In Progress → In Testing | FE, TEST | PR merged, Swagger cập nhật, Postman chạy được |
| 5 | FE | Màn hình Login (5.3) | Sub-task → In Progress → In Testing | BA | PR merged, ảnh màn hình |
| 6 | BA | Nghiệm thu nội bộ (5.10) | Story → In Testing | TEST | Comment "AC1-AC3 đạt" hoặc trả lại |
| 7 | TEST | Chạy test (5.11) | Sub-task → Done, hoặc tạo Bug | PM hoặc BE/FE | Kết quả + ảnh evidence |
| 8 | PM | Sprint Review | Story → Done | - | Demo, cập nhật Burndown |

## 6. Quy trình xử lý Bug

| Bước | Vai trò | Hành động trên Jira |
|---|---|---|
| 1 | TEST | Create → **Bug**, summary `[BUG] <mô tả>`, Priority theo severity (S1 Highest, S2 High, S3 Medium, S4 Low), label `bug-S1..S4` + mã test case, link **is caused by** tới Sub-task/Story |
| 2 | TEST | Sub-task/Story liên quan trả về **In Progress** |
| 3 | BE hoặc FE | Nhận Bug → In Progress; sửa kèm test tái hiện; commit `IM-xx: fix ...` |
| 4 | BE hoặc FE | Bug → **In Testing**, comment bàn giao |
| 5 | TEST | Verify: đạt → **Done**; chưa đạt → trả về In Progress (Reopen) kèm lý do |
| 6 | PM | Theo dõi: S1 sửa trong ngày, S2 trong Sprint; không đóng Sprint khi còn S1/S2 |

## 7. Nhịp làm việc: ngày, tuần, Sprint

**Mỗi ngày**

| Khung giờ | Vai trò | Việc |
|---|---|---|
| 19:00 - 19:30 | PM | Daily log (hôm qua / hôm nay / vướng gì) vào comment, Log work, xem việc găng |
| 19:30 - 20:30 | BA | Chốt AC, trả lời câu hỏi nghiệp vụ, nghiệm thu |
| 20:30 - 22:00 | BE / FE | Code theo Sub-task (luân phiên theo ngày) |
| 22:00 - 22:30 | TEST | Test việc ở cột In Testing, ghi Bug |

**Mỗi tuần (Chủ nhật):** PM viết Weekly Status Report (SP hoàn thành, SPI/CPI, Bug mở, rủi ro).

**Mỗi Sprint (2 tuần)**

| Thời điểm | Vai trò | Việc | Đầu ra |
|---|---|---|---|
| Thứ Hai tuần 1 | PM | Sprint Planning, Start sprint | Sprint Goal |
| Thứ Hai - Thứ Ba tuần 1 | BA | Chốt AC (x.1) | AC chốt, bàn giao BE/FE/TEST |
| Tuần 1 - giữa tuần 2 | BE → FE | Phát triển | PR merged, Sub-task In Testing |
| Thứ Năm tuần 2 | BA | Nghiệm thu nội bộ (x.10) | Story In Testing |
| Thứ Năm - Thứ Sáu tuần 2 | TEST | Chạy test case (x.11) | Kết quả test, Bug |
| Thứ Sáu tuần 2 | BA | Refine backlog Sprint sau (x.12) | Story Sprint sau đạt DoR |
| Thứ Sáu tuần 2 | PM | Review, Retrospective, Complete sprint | Burndown, Sprint report, biên bản |

## 8. Git và liên kết Jira

| Mục | Quy ước |
|---|---|
| Nhánh | `main` (phát hành), `develop` (tích hợp), `feature/IM-<số>-mo-ta`, `hotfix/IM-<số>` |
| Commit | `IM-123: them API check-in` (có mã để Jira tự gắn commit vào work item) |
| Pull Request | Vào `develop`; tự review theo checklist: đúng AC, có test, không lộ secret, CI xanh |
| Tag | Cuối Sprint `v0.1`..`v0.4`, phát hành `v1.0.0` |
| Bàn giao BE → FE | PR merged vào `develop` + Swagger cập nhật + ví dụ request/response trong comment |

## 9. Definition of Ready và Definition of Done

**Definition of Ready** (BA kiểm tra trước Sprint Planning)
- [ ] Story có mô tả dạng "Là... tôi muốn... để..."
- [ ] Có ít nhất 2 Acceptance Criteria Given-When-Then
- [ ] Đã ước lượng Story Point
- [ ] Không còn phụ thuộc chưa xong; thiết kế UI/API liên quan đã có

**Definition of Done**
- [ ] Code merged vào `develop` qua PR, CI xanh
- [ ] Unit test tầng Service (BE) đạt
- [ ] BA nghiệm thu đạt toàn bộ AC
- [ ] Test case liên quan đạt, không còn Bug S1/S2 mở
- [ ] Swagger/tài liệu cập nhật, Log work đầy đủ

## 10. Mẫu comment bàn giao

Dán vào comment của work item mỗi khi chuyển trạng thái để bàn giao:

```
[BÀN GIAO] BE → FE, TEST
Việc: IM-xx [BE] 5.2 API login
Đầu ra: PR #12 merged vào develop; Swagger /api/v1/auth/*
Cách kiểm tra: Postman collection "Auth" (TC-AUTH-01..04)
Lưu ý: token hạn 8 giờ; tài khoản khóa trả 403
Việc tiếp theo mở khóa: 5.3 (FE), 5.4 (BE), 5.11 (TEST)
```

```
[NGHIỆM THU] BA → TEST
Story: IM-xx US-01 Đăng nhập
Kết quả: AC1 đạt, AC2 đạt, AC3 đạt
Chuyển In Testing để TEST chạy TC-AUTH-01..04
```

```
[KẾT QUẢ TEST] TEST → PM
Story: IM-xx US-01 | Chạy 4/4 test case: 4 đạt, 0 lỗi
Evidence: ảnh đính kèm | Đề nghị đóng Story
```

## 11. Quản lý thay đổi (Change Request)

1. Ghi nhận yêu cầu thay đổi: tạo Task `[CR] <mô tả>`, label `change-request`.
2. **BA** phân tích tác động: FR/BR/AC/RTM bị ảnh hưởng.
3. **PM** đánh giá tác động lịch, chi phí, rủi ro so với baseline Gantt.
4. Ảnh hưởng mốc → hỏi ý kiến giảng viên. Quyết định ghi vào comment.
5. Được duyệt: BA cập nhật AC/RTM (việc 2.9), PM cập nhật backlog và Gantt, thông báo vai trò liên quan.

## 12. Bảng bàn giao chi tiết theo từng việc

Sinh tự động từ phần phụ thuộc trong `src/ims_details.py`. Cột **Bàn giao cho** là vai trò của các việc chỉ được bắt đầu khi việc này xong. Việc có ★ nằm trên đường găng.

### 1. Quản trị dự án

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 1.1 ★ | PM | Viết Project Charter: mục tiêu, phạm vi, stakeholder, tiêu chí thành công SC-01..SC-06 | Project Charter (Word/PDF) trong docs/pm/ | PM | 1.2, 1.7 |
| 1.2 | PM | Lập Scope Statement: chốt in-scope FR-01..FR-30 và danh sách out-of-scope | Scope Statement | PM | 1.3 |
| 1.3 | PM | Phân rã WBS 10 nhóm công việc, ước lượng Story Point (Planning Poker) và giờ công | Bảng WBS + ước lượng (Excel) | PM | 1.4, 1.5, 1.6 |
| 1.4 | PM | Lập Gantt baseline, xác định đường găng và 6 mốc kiểm soát M1..M6 | IMS_Gantt_Chart.xlsx (baseline) | PM | 1.6 |
| 1.5 | PM | Lập kế hoạch nguồn lực 1 người - 5 vai trò: lịch luân phiên vai trò và ma trận RACI | Lịch đội mũ + RACI | PM (đóng việc) | - |
| 1.6 | PM | Tạo project Jira Scrum: 10 Epic, 6 Sprint, 16 User Story; import backlog bằng CSV | Jira space IMS có đủ Epic/Story/Task/Subtask | PM | 1.8, 1.9 |
| 1.7 | PM | Lập Risk Register R-01..R-12, Communication Plan và biểu mẫu Change Request | Risk Register, Communication Plan, mẫu CR | PM (đóng việc) | - |
| 1.8 | PM | Chủ trì Sprint Planning, Daily log, Sprint Review và Retrospective cho 5 Sprint | Biên bản Planning/Review/Retro mỗi Sprint | PM (đóng việc) | - |
| 1.9 | PM | Cập nhật Burndown, Weekly Status Report và chỉ số EVM (PV, EV, AC, SPI, CPI) hằng tuần | 12 Weekly Status Report | PM (đóng việc) | - |
| 1.10 | PM | Viết báo cáo tổng kết, lessons learned và bàn giao hồ sơ dự án | Báo cáo tổng kết | PM | 10.12 |

### 2. Phân tích nghiệp vụ và đặc tả yêu cầu

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 2.1 | BA | Khảo sát quy trình thực tập: phỏng vấn giả lập Admin (HR), Mentor, Intern | Biên bản khảo sát | BA | 2.2 |
| 2.2 ★ | BA | Viết đặc tả 30 yêu cầu chức năng FR-01..FR-30 vào tài liệu SRS | SRS phần yêu cầu chức năng | BA, FE | 2.3, 2.4, 2.5, 2.7, 3.1 |
| 2.3 | BA | Viết 10 yêu cầu phi chức năng NFR-01..NFR-10 kèm ngưỡng đo được | SRS phần phi chức năng | BE | 3.3 |
| 2.4 | BA | Viết 15 Business Rule BR-01..BR-15 cho đăng ký, phân Mentor, chấm công, báo cáo, đánh giá | Danh sách Business Rules | BA, BE | 2.7, 3.4 |
| 2.5 | BA | Vẽ Use Case Diagram 3 actor và đặc tả 12 Use Case UC-01..UC-12 | Use Case Diagram + đặc tả | BA | 2.6 |
| 2.6 | BA | Vẽ Activity Diagram luồng thực tập và State Diagram cho hồ sơ Intern và Task | Activity Diagram, 2 State Diagram | PM (đóng việc) | - |
| 2.7 ★ | BA | Viết 16 User Story US-01..US-16 kèm Acceptance Criteria dạng Given - When - Then | Product Backlog 16 Story | BA, TEST | 2.8, 5.1, 9.1 |
| 2.8 | BA | Lập ma trận truy vết RTM nối FR - User Story - API/UI - Test Case | RTM (Excel) | BA | 2.9 |
| 2.9 | BA | Cập nhật RTM và Acceptance Criteria sau mỗi Change Request được duyệt | RTM và AC phiên bản mới | PM (đóng việc) | - |

### 3. Thiết kế hệ thống

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 3.1 | FE | Vẽ sitemap 3 role và luồng chuyển màn hình cho 12 giao diện UI-01..UI-12 | Sitemap (draw.io) | FE | 3.2 |
| 3.2 | FE | Vẽ wireframe Figma: Login, Dashboard, Intern List/Detail, Task, Weekly Report, Evaluation | Link Figma wireframe | BA, FE | 3.6, 4.5 |
| 3.3 | BE | Chốt kiến trúc: React SPA + Spring Boot REST 3 lớp Controller - Service - Repository | Tài liệu kiến trúc 1-2 trang | BE | 3.4 |
| 3.4 | BE | Thiết kế ERD 12 bảng MySQL, khóa ngoại, ràng buộc UNIQUE và index | ERD + script V1__init.sql | BE | 3.5, 4.4 |
| 3.5 ★ | BE | Đặc tả 36 endpoint /api/v1 bằng OpenAPI kèm DTO và bảng mã lỗi 400/401/403/404/409 | openapi.yaml | BA, BE | 3.6, 5.2 |
| 3.6 | BA | Đối chiếu thiết kế UI-01..UI-12 và API với FR-01..FR-30, BR-01..BR-15 | Biên bản rà soát thiết kế | PM | 3.7 |
| 3.7 | PM | Rà soát chéo toàn bộ thiết kế và ký duyệt Design Baseline | Design Baseline được duyệt | PM (đóng việc) | - |

### 4. Thiết lập hạ tầng và môi trường

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 4.1 | BE | Tạo GitHub repository, bảo vệ nhánh main/develop, quy ước Git Flow và Pull Request | Repo GitHub | BE | 4.2, 4.3 |
| 4.2 | BE | Kết nối Jira với GitHub (GitHub for Jira), quy ước commit/branch chứa mã IM-xx | Jira hiển thị commit/PR trong work item | PM (đóng việc) | - |
| 4.3 | BE | Viết docker-compose.yml cho MySQL 8, backend, frontend và phpMyAdmin | docker-compose.yml | BE | 4.4 |
| 4.4 | BE | Khởi tạo Spring Boot 3: cấu trúc package, Spring Data JPA, migration Flyway V1 | Backend skeleton chạy được | BE | 4.6, 5.2 |
| 4.5 | FE | Khởi tạo React + Vite + Tailwind: router, layout, axios interceptor, xử lý lỗi tập trung | Frontend skeleton chạy được | FE, BE | 4.6, 5.3 |
| 4.6 | BE | Cấu hình GitHub Actions: build, unit test và lint cho mỗi Pull Request | Workflow CI | PM (đóng việc) | - |

### 5. Sprint 1 - Đăng nhập, phân quyền, tài khoản và phòng ban

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 5.1 | BA | Chốt Acceptance Criteria US-01..US-04 và ma trận quyền 3 role trước Sprint Planning | AC chốt + ma trận quyền | BE | 5.2, 5.4 |
| 5.2 ★ | BE | Viết API POST /auth/login, /auth/logout, GET /auth/me phát hành JWT (US-01) | API xác thực + unit test | FE, BE, TEST | 5.3, 5.4, 9.3 |
| 5.3 | FE | Dựng màn hình đăng nhập UI-01, lưu token và điều hướng theo role (US-01) | Màn hình Login | FE | 5.5 |
| 5.4 ★ | BE | Cấu hình Spring Security: filter JWT và @PreAuthorize theo 3 role (US-02) | Cấu hình Spring Security | FE, BE | 5.5, 5.6, 5.7, 6.2 |
| 5.5 | FE | Chặn route, ẩn menu theo role trên frontend và trang lỗi 403 (US-02) | Route guard + menu theo role | BA | 5.10 |
| 5.6 | BE | Viết API CRUD /users kèm khóa/mở tài khoản và đổi mật khẩu (US-03) | API quản lý tài khoản | FE, BE | 5.8, 5.9 |
| 5.7 | BE | Viết API CRUD /departments, chặn xóa phòng ban còn Intern (US-04) | API phòng ban | FE, BE | 5.8, 5.9 |
| 5.8 | FE | Dựng màn hình quản lý tài khoản UI-10 và phòng ban UI-11 (US-03, US-04) | Màn hình UI-10, UI-11 | BA | 5.10 |
| 5.9 | BE | Nạp seed data: 1 Admin, 3 phòng ban, 3 Mentor, 10 Intern kiểm thử | Migration seed | TEST | 5.11 |
| 5.10 | BA | Nghiệm thu nội bộ UI-01, UI-10, UI-11 theo Acceptance Criteria US-01..US-04 | Biên bản nghiệm thu Sprint 1 | BA, TEST | 5.11, 5.12 |
| 5.11 | TEST | Chạy TC-AUTH-01..04, TC-RBAC-01..03, TC-USR-01..02, TC-DEP-01 và lưu evidence | Kết quả test Sprint 1 | PM (đóng việc) | - |
| 5.12 | BA | Refine backlog Sprint 2: bổ sung Acceptance Criteria US-05..US-08 và cập nhật RTM | Backlog Sprint 2 sẵn sàng | BA | 6.1 |

### 6. Sprint 2 - Hồ sơ thực tập sinh và Mentor

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 6.1 | BA | Chốt Acceptance Criteria US-05..US-08 và quy tắc BR-01..BR-05 | AC + BR chốt | BE | 6.2 |
| 6.2 ★ | BE | Viết API POST /applications nhận đơn đăng ký và CV PDF tối đa 5 MB (US-05) | API đăng ký | FE, BE | 6.3, 6.4 |
| 6.3 | FE | Dựng form đăng ký thực tập UI-02 có kiểm tra dữ liệu đầu vào (US-05) | Màn hình UI-02 | FE | 6.5 |
| 6.4 ★ | BE | Viết API duyệt/từ chối hồ sơ, tự tạo tài khoản Intern và gửi email thông báo (US-06) | API duyệt/từ chối | FE, BE | 6.5, 6.6 |
| 6.5 | FE | Dựng màn hình danh sách và duyệt hồ sơ đăng ký UI-03 (US-06) | Màn hình UI-03 | BA | 6.10 |
| 6.6 | BE | Viết API /interns: tìm kiếm, lọc, phân trang, cập nhật hồ sơ, phân phòng ban (US-07) | API Intern | FE, BE | 6.7, 6.8, 7.6 |
| 6.7 | FE | Dựng màn hình Intern List UI-04 và Intern Detail UI-05 (US-07) | Màn hình UI-04, UI-05 | FE | 6.9 |
| 6.8 ★ | BE | Viết API /mentors và phân Mentor cho Intern, tối đa 5 Intern/Mentor theo BR-04 (US-08) | API Mentor | FE, BE | 6.9, 7.2, 8.2 |
| 6.9 | FE | Dựng màn hình Mentor List UI-06 và hộp thoại phân công Mentor (US-08) | Màn hình UI-06 | BA | 6.10 |
| 6.10 | BA | Nghiệm thu nội bộ UI-02..UI-06 theo Acceptance Criteria US-05..US-08 | Biên bản nghiệm thu Sprint 2 | BA, TEST | 6.11, 6.12 |
| 6.11 | TEST | Chạy TC-REG-01..03, TC-APR-01..02, TC-INT-01..03, TC-MEN-01..02 và lưu evidence | Kết quả test Sprint 2 | PM (đóng việc) | - |
| 6.12 | BA | Refine backlog Sprint 3: bổ sung Acceptance Criteria US-09..US-12 và cập nhật RTM | Backlog Sprint 3 sẵn sàng | BA | 7.1 |

### 7. Sprint 3 - Giao việc, chấm công và báo cáo tuần

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 7.1 | BA | Chốt Acceptance Criteria US-09..US-12, vòng đời Task và quy tắc chấm công BR-06..BR-10 | AC + State Diagram Task | BE | 7.2 |
| 7.2 ★ | BE | Viết API POST /tasks và danh sách task theo Intern cho Mentor (US-09) | API giao task | FE, BE | 7.3, 7.4 |
| 7.3 | FE | Dựng Task Board của Mentor UI-07 và form giao task có deadline (US-09) | Màn hình UI-07 | FE | 7.5 |
| 7.4 ★ | BE | Viết API GET /tasks/my-tasks, PUT /tasks/{id}/status và bình luận task (US-10) | API cập nhật task + bình luận | FE, BE | 7.5, 7.8, 8.4 |
| 7.5 | FE | Dựng màn hình My Tasks UI-08 và Task Detail kèm bình luận (US-10) | Màn hình UI-08 | BA | 7.10 |
| 7.6 | BE | Viết API check-in/check-out /attendances, chặn chấm công trùng trong ngày BR-08 (US-11) | API chấm công | FE, BE | 7.7, 8.4 |
| 7.7 | FE | Dựng nút chấm công và bảng công tháng cho Intern, Mentor (US-11) | Chức năng chấm công trên UI | BA | 7.10 |
| 7.8 ★ | BE | Viết API /weekly-reports: nộp, hạn chót Chủ nhật 23:59 theo BR-10, Mentor phản hồi (US-12) | API báo cáo tuần | FE, BE | 7.9, 8.4 |
| 7.9 | FE | Dựng màn hình Weekly Report UI-09 cho Intern và Mentor (US-12) | Màn hình UI-09 | BA | 7.10 |
| 7.10 | BA | Nghiệm thu nội bộ UI-07..UI-09 theo Acceptance Criteria US-09..US-12 | Biên bản nghiệm thu Sprint 3 | BA, TEST | 7.11, 7.12 |
| 7.11 | TEST | Chạy TC-TASK-01..05, TC-ATT-01..03, TC-RPT-01..03 và lưu evidence | Kết quả test Sprint 3 | PM (đóng việc) | - |
| 7.12 | BA | Refine backlog Sprint 4: bổ sung Acceptance Criteria US-13..US-16 và cập nhật RTM | Backlog Sprint 4 sẵn sàng | BA | 8.1 |

### 8. Sprint 4 - Đánh giá, tiến độ, dashboard và xuất kết quả

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 8.1 | BA | Chốt 5 tiêu chí đánh giá thang 10, công thức tính tiến độ và chỉ số dashboard | Tài liệu tiêu chí + công thức | BE | 8.2 |
| 8.2 | BE | Viết API /evaluations giữa kỳ và cuối kỳ, chỉ Mentor phụ trách được chấm BR-12 (US-13) | API đánh giá | FE, BE | 8.3, 8.8 |
| 8.3 | FE | Dựng form đánh giá UI-12 cho Mentor và trang xem đánh giá cho Intern (US-13) | Màn hình UI-12 | PM (đóng việc) | - |
| 8.4 ★ | BE | Viết service tính tiến độ: 50% task DONE + 25% báo cáo tuần + 25% chuyên cần (US-14) | API tiến độ | FE, BE | 8.5, 8.6 |
| 8.5 | FE | Hiển thị thanh tiến độ trên Intern Detail và Intern Dashboard (US-14) | Component thanh tiến độ | PM (đóng việc) | - |
| 8.6 ★ | BE | Viết API /dashboard/admin, /dashboard/mentor, /dashboard/intern tổng hợp số liệu (US-15) | API dashboard | FE | 8.7 |
| 8.7 | FE | Dựng 3 dashboard bằng Recharts: số Intern, tiến độ, task quá hạn, điểm trung bình (US-15) | Màn hình UI-13 | BA, TEST | 8.10, 9.6 |
| 8.8 ★ | BE | Xuất kết quả cuối kỳ ra Excel (Apache POI) và PDF, chuyển trạng thái COMPLETED (US-16) | API xuất file + kết thúc kỳ | FE | 8.9 |
| 8.9 | FE | Thêm nút xuất file và thao tác kết thúc kỳ thực tập trên giao diện Admin (US-16) | Chức năng trên UI Admin | BA | 8.10 |
| 8.10 | BA | Kiểm tra số liệu dashboard và file kết quả khớp BR-11..BR-15 | Biên bản đối chiếu số liệu | BA, TEST | 8.11, 8.12 |
| 8.11 | TEST | Chạy TC-EVA-01..03, TC-PRG-01, TC-DSH-01..02, TC-EXP-01..02 và lưu evidence | Kết quả test Sprint 4 | PM (đóng việc) | - |
| 8.12 | BA | Viết 8 kịch bản UAT UAT-01..UAT-08 và chuẩn bị dữ liệu nghiệp vụ | Bộ kịch bản UAT | BA | 10.6 |

### 9. Kiểm thử và đảm bảo chất lượng

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 9.1 | TEST | Viết Test Plan: phạm vi, môi trường, mức độ nghiêm trọng S1..S4, tiêu chí vào/ra | Test Plan | TEST | 9.2, 9.5 |
| 9.2 | TEST | Viết 40 test case TC-AUTH..TC-EXP trên Excel và dựng bộ dữ liệu kiểm thử | Bộ test case (Excel) | TEST | 5.11, 9.3, 9.4 |
| 9.3 | TEST | Xây Postman collection và Newman để chạy hồi quy API tự động | Postman collection + lệnh Newman | PM (đóng việc) | - |
| 9.4 | TEST | Kiểm thử API và giao diện cho từng User Story khi chuyển sang IN TESTING | Kết quả test cập nhật trên Jira | PM (đóng việc) | - |
| 9.5 | TEST | Ghi Bug lên Jira kèm severity, bước tái hiện, evidence và xác minh bản vá | Bug trên Jira | FE, BE | 10.1, 10.2 |
| 9.6 | TEST | Tự động hóa 5 luồng chính bằng Selenium WebDriver | Bộ test Selenium | TEST | 9.7 |
| 9.7 ★ | TEST | Chạy hồi quy toàn bộ luồng Critical và High bằng Newman + Selenium + kiểm thử tay | Test Report hồi quy | BE | 10.4 |

### 10. Sprint 5 - Ổn định, nghiệm thu và phát hành

| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |
|---|---|---|---|---|---|
| 10.1 ★ | BE | Sửa dứt điểm bug S1, S2 phía backend và cập nhật trạng thái trên Jira | Bản sửa backend | BE, TEST | 9.7, 10.3 |
| 10.2 | FE | Sửa dứt điểm bug S1, S2 phía frontend và cập nhật trạng thái trên Jira | Bản sửa frontend | TEST | 9.7 |
| 10.3 | BE | Tối ưu truy vấn chậm và rà soát bảo mật cơ bản theo OWASP Top 10 | Danh sách vấn đề đã xử lý | BE | 10.4 |
| 10.4 ★ | BE | Tạo nhánh release, gắn tag v1.0.0 và chạy thử migration Flyway trên bản backup | Tag v1.0.0 | BA, BE | 10.5, 10.9, 10.10, 10.11 |
| 10.5 | BE | Triển khai môi trường UAT bằng Docker Compose và nạp dữ liệu gần thực tế | Môi trường UAT | BA | 10.6 |
| 10.6 ★ | BA | Điều phối UAT: chạy 8 kịch bản UAT-01..UAT-08 với người dùng đại diện | Kết quả UAT | TEST | 10.7 |
| 10.7 | TEST | Ghi nhận kết quả UAT, phân loại lỗi S1..S4 và xác minh bản vá | Danh sách lỗi UAT | BA | 10.8 |
| 10.8 | BA | Tổng hợp phản hồi UAT, cập nhật RTM và lấy biên bản UAT Sign-off | Biên bản UAT Sign-off | PM | 1.10, 10.12 |
| 10.9 | BE | Viết Release Notes, Deployment Guide, cập nhật Swagger và README | Bộ tài liệu kỹ thuật | PM | 10.12 |
| 10.10 | BA | Viết User Manual cho 3 nhóm người dùng kèm ảnh màn hình UI-01..UI-12 | User Manual | PM | 10.12 |
| 10.11 | BE | Sao lưu database, repository và đóng gói mã nguồn bàn giao | File backup + gói mã nguồn | PM (đóng việc) | - |
| 10.12 ★ | PM | Trình bày nghiệm thu: demo 15 phút, evidence Jira/GitHub, so sánh baseline và thực tế | Buổi nghiệm thu | PM (đóng việc) | - |

### Mốc kiểm soát

| Mốc | Ngày | Người kiểm tra |
|---|---|---|
| M1 - Chốt baseline phạm vi, yêu cầu và thiết kế | 11/09/2026 | PM (go/no-go) |
| M2 - Hoàn thành đăng nhập, phân quyền và quản trị | 25/09/2026 | PM (go/no-go) |
| M3 - Hoàn thành hồ sơ Intern, Mentor và phân công | 09/10/2026 | PM (go/no-go) |
| M4 - Hoàn thành giao việc, chấm công và báo cáo tuần | 23/10/2026 | PM (go/no-go) |
| M5 - Feature Complete: đánh giá, tiến độ, dashboard, xuất kết quả | 06/11/2026 | PM (go/no-go) |
| M6 - Nghiệm thu và phát hành IMS v1.0.0 | 20/11/2026 | PM (go/no-go) |

---
_Sinh bằng `python src/build_workflow_md.py docs/WORKFLOW.md`. Sprint: IMS Sprint 0, IMS Sprint 1, IMS Sprint 2, IMS Sprint 3, IMS Sprint 4, IMS Sprint 5._
