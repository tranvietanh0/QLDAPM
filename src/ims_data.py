"""Single source of truth for the Intern Management System (IMS) project plan.

The Word report, the Excel Gantt chart and the Jira CSV are all generated from
this module, so dates, owners and IDs always agree across the three outputs.
"""
from datetime import date, timedelta

PROJECT = {
    "code": "IMS",
    "name": "IMS - Hệ thống quản lý thực tập sinh (Intern Management System)",
    "short": "Intern Management System",
    "student": "Trần Việt Anh",
    "roles": "PM, BA, FE, BE, TEST",
    "course": "Quản lý dự án phần mềm",
    "school": "Học viện Công nghệ Bưu chính Viễn thông (PTIT)",
    "start": date(2026, 8, 31),
    "end": date(2026, 11, 20),
    "version": "v1.0.0",
}


def d(m, day):
    return date(2026, m, day)


SPRINTS = [
    # key, name, start, end, goal, stories
    ("S0", "IMS Sprint 0", d(8, 31), d(9, 11), "SPRINT 0 - KHỞI ĐỘNG & THIẾT KẾ",
     "Charter, SRS, Use Case, User Story, thiết kế UI/ERD/API, hạ tầng GitHub - Jira - CI", []),
    ("S1", "IMS Sprint 1", d(9, 14), d(9, 25), "SPRINT 1 - ĐĂNG NHẬP & QUẢN TRỊ",
     "Đăng nhập JWT, phân quyền 3 role, quản lý tài khoản và phòng ban", ["US-01", "US-02", "US-03", "US-04"]),
    ("S2", "IMS Sprint 2", d(9, 28), d(10, 9), "SPRINT 2 - HỒ SƠ INTERN & MENTOR",
     "Đăng ký thực tập, duyệt hồ sơ, quản lý Intern, quản lý và phân công Mentor", ["US-05", "US-06", "US-07", "US-08"]),
    ("S3", "IMS Sprint 3", d(10, 12), d(10, 23), "SPRINT 3 - GIAO VIỆC & BÁO CÁO",
     "Giao và theo dõi task, chấm công, nộp báo cáo tuần", ["US-09", "US-10", "US-11", "US-12"]),
    ("S4", "IMS Sprint 4", d(10, 26), d(11, 6), "SPRINT 4 - ĐÁNH GIÁ & DASHBOARD",
     "Đánh giá Intern, theo dõi tiến độ, dashboard, xuất kết quả cuối kỳ", ["US-13", "US-14", "US-15", "US-16"]),
    ("S5", "IMS Sprint 5", d(11, 9), d(11, 20), "SPRINT 5 - KIỂM THỬ & PHÁT HÀNH",
     "Hồi quy, sửa bug, UAT, phát hành v1.0.0 và nghiệm thu", []),
]


def sprint_of(day):
    for s in SPRINTS:
        if s[2] <= day <= s[3]:
            return s
    raise ValueError(f"{day} is outside every sprint")


# ---------------------------------------------------------------- WBS / Gantt
# (id, title, owner, start, due, hours, story)
# Group rows (id without a dot) carry hours=None; their dates wrap their children.
# Milestones live in group 11 and take zero effort.
WBS = [
    ("1", "Quản trị dự án", "PM", d(8, 31), d(11, 20), None, None),
    ("1.1", "Viết Project Charter: mục tiêu, phạm vi, stakeholder, tiêu chí thành công SC-01..SC-06", "PM", d(8, 31), d(9, 1), 4, None),
    ("1.2", "Lập Scope Statement: chốt in-scope FR-01..FR-30 và danh sách out-of-scope", "PM", d(9, 1), d(9, 2), 3, None),
    ("1.3", "Phân rã WBS 10 nhóm công việc, ước lượng Story Point (Planning Poker) và giờ công", "PM", d(9, 3), d(9, 4), 4, None),
    ("1.4", "Lập Gantt baseline, xác định đường găng và 6 mốc kiểm soát M1..M6", "PM", d(9, 4), d(9, 7), 3, None),
    ("1.5", "Lập kế hoạch nguồn lực 1 người - 5 vai trò: lịch luân phiên vai trò và ma trận RACI", "PM", d(9, 7), d(9, 8), 2, None),
    ("1.6", "Tạo project Jira Scrum: 10 Epic, 6 Sprint, 16 User Story; import backlog bằng CSV", "PM", d(9, 8), d(9, 9), 2, None),
    ("1.7", "Lập Risk Register R-01..R-12, Communication Plan và biểu mẫu Change Request", "PM", d(9, 9), d(9, 11), 2, None),
    ("1.8", "Chủ trì Sprint Planning, Daily log, Sprint Review và Retrospective cho 5 Sprint", "PM", d(9, 14), d(11, 20), 15, None),
    ("1.9", "Cập nhật Burndown, Weekly Status Report và chỉ số EVM (PV, EV, AC, SPI, CPI) hằng tuần", "PM", d(9, 14), d(11, 20), 10, None),
    ("1.10", "Viết báo cáo tổng kết, lessons learned và bàn giao hồ sơ dự án", "PM", d(11, 18), d(11, 20), 4, None),

    ("2", "Phân tích nghiệp vụ và đặc tả yêu cầu", "BA", d(8, 31), d(11, 6), None, None),
    ("2.1", "Khảo sát quy trình thực tập: phỏng vấn giả lập Admin (HR), Mentor, Intern", "BA", d(8, 31), d(9, 1), 4, None),
    ("2.2", "Viết đặc tả 30 yêu cầu chức năng FR-01..FR-30 vào tài liệu SRS", "BA", d(9, 1), d(9, 3), 6, None),
    ("2.3", "Viết 10 yêu cầu phi chức năng NFR-01..NFR-10 kèm ngưỡng đo được", "BA", d(9, 3), d(9, 4), 2, None),
    ("2.4", "Viết 15 Business Rule BR-01..BR-15 cho đăng ký, phân Mentor, chấm công, báo cáo, đánh giá", "BA", d(9, 4), d(9, 7), 3, None),
    ("2.5", "Vẽ Use Case Diagram 3 actor và đặc tả 12 Use Case UC-01..UC-12", "BA", d(9, 7), d(9, 8), 3, None),
    ("2.6", "Vẽ Activity Diagram luồng thực tập và State Diagram cho hồ sơ Intern và Task", "BA", d(9, 8), d(9, 9), 2, None),
    ("2.7", "Viết 16 User Story US-01..US-16 kèm Acceptance Criteria dạng Given - When - Then", "BA", d(9, 8), d(9, 10), 4, None),
    ("2.8", "Lập ma trận truy vết RTM nối FR - User Story - API/UI - Test Case", "BA", d(9, 10), d(9, 11), 2, None),
    ("2.9", "Cập nhật RTM và Acceptance Criteria sau mỗi Change Request được duyệt", "BA", d(9, 14), d(11, 6), 4, None),

    ("3", "Thiết kế hệ thống", "BE", d(9, 3), d(9, 11), None, None),
    ("3.1", "Vẽ sitemap 3 role và luồng chuyển màn hình cho 12 giao diện UI-01..UI-12", "FE", d(9, 3), d(9, 7), 3, None),
    ("3.2", "Vẽ wireframe Figma: Login, Dashboard, Intern List/Detail, Task, Weekly Report, Evaluation", "FE", d(9, 7), d(9, 9), 4, None),
    ("3.3", "Chốt kiến trúc: React SPA + Spring Boot REST 3 lớp Controller - Service - Repository", "BE", d(9, 7), d(9, 8), 2, None),
    ("3.4", "Thiết kế ERD 12 bảng MySQL, khóa ngoại, ràng buộc UNIQUE và index", "BE", d(9, 8), d(9, 10), 3, None),
    ("3.5", "Đặc tả 36 endpoint /api/v1 bằng OpenAPI kèm DTO và bảng mã lỗi 400/401/403/404/409", "BE", d(9, 9), d(9, 11), 4, None),
    ("3.6", "Đối chiếu thiết kế UI-01..UI-12 và API với FR-01..FR-30, BR-01..BR-15", "BA", d(9, 10), d(9, 11), 2, None),
    ("3.7", "Rà soát chéo toàn bộ thiết kế và ký duyệt Design Baseline", "PM", d(9, 11), d(9, 11), 1, None),

    ("4", "Thiết lập hạ tầng và môi trường", "BE", d(8, 31), d(9, 16), None, None),
    ("4.1", "Tạo GitHub repository, bảo vệ nhánh main/develop, quy ước Git Flow và Pull Request", "BE", d(8, 31), d(9, 1), 2, None),
    ("4.2", "Kết nối Jira với GitHub (GitHub for Jira), quy ước commit/branch chứa mã IM-xx", "BE", d(9, 1), d(9, 2), 1, None),
    ("4.3", "Viết docker-compose.yml cho MySQL 8, backend, frontend và phpMyAdmin", "BE", d(9, 3), d(9, 4), 2, None),
    ("4.4", "Khởi tạo Spring Boot 3: cấu trúc package, Spring Data JPA, migration Flyway V1", "BE", d(9, 9), d(9, 11), 2, None),
    ("4.5", "Khởi tạo React + Vite + Tailwind: router, layout, axios interceptor, xử lý lỗi tập trung", "FE", d(9, 14), d(9, 15), 2, None),
    ("4.6", "Cấu hình GitHub Actions: build, unit test và lint cho mỗi Pull Request", "BE", d(9, 14), d(9, 16), 2, None),

    ("5", "Sprint 1 - Đăng nhập, phân quyền, tài khoản và phòng ban", "PM", d(9, 14), d(9, 25), None, None),
    ("5.1", "Chốt Acceptance Criteria US-01..US-04 và ma trận quyền 3 role trước Sprint Planning", "BA", d(9, 14), d(9, 15), 2, None),
    ("5.2", "Viết API POST /auth/login, /auth/logout, GET /auth/me phát hành JWT (US-01)", "BE", d(9, 14), d(9, 16), 5, "US-01"),
    ("5.3", "Dựng màn hình đăng nhập UI-01, lưu token và điều hướng theo role (US-01)", "FE", d(9, 16), d(9, 18), 4, "US-01"),
    ("5.4", "Cấu hình Spring Security: filter JWT và @PreAuthorize theo 3 role (US-02)", "BE", d(9, 17), d(9, 21), 4, "US-02"),
    ("5.5", "Chặn route, ẩn menu theo role trên frontend và trang lỗi 403 (US-02)", "FE", d(9, 21), d(9, 22), 3, "US-02"),
    ("5.6", "Viết API CRUD /users kèm khóa/mở tài khoản và đổi mật khẩu (US-03)", "BE", d(9, 21), d(9, 23), 4, "US-03"),
    ("5.7", "Viết API CRUD /departments, chặn xóa phòng ban còn Intern (US-04)", "BE", d(9, 22), d(9, 23), 2, "US-04"),
    ("5.8", "Dựng màn hình quản lý tài khoản UI-10 và phòng ban UI-11 (US-03, US-04)", "FE", d(9, 22), d(9, 24), 4, "US-03"),
    ("5.9", "Nạp seed data: 1 Admin, 3 phòng ban, 3 Mentor, 10 Intern kiểm thử", "BE", d(9, 23), d(9, 24), 1, None),
    ("5.10", "Nghiệm thu nội bộ UI-01, UI-10, UI-11 theo Acceptance Criteria US-01..US-04", "BA", d(9, 24), d(9, 24), 1, None),
    ("5.11", "Chạy TC-AUTH-01..04, TC-RBAC-01..03, TC-USR-01..02, TC-DEP-01 và lưu evidence", "TEST", d(9, 24), d(9, 25), 3, None),
    ("5.12", "Refine backlog Sprint 2: bổ sung Acceptance Criteria US-05..US-08 và cập nhật RTM", "BA", d(9, 25), d(9, 25), 1, None),

    ("6", "Sprint 2 - Hồ sơ thực tập sinh và Mentor", "PM", d(9, 28), d(10, 9), None, None),
    ("6.1", "Chốt Acceptance Criteria US-05..US-08 và quy tắc BR-01..BR-05", "BA", d(9, 28), d(9, 29), 2, None),
    ("6.2", "Viết API POST /applications nhận đơn đăng ký và CV PDF tối đa 5 MB (US-05)", "BE", d(9, 28), d(9, 30), 4, "US-05"),
    ("6.3", "Dựng form đăng ký thực tập UI-02 có kiểm tra dữ liệu đầu vào (US-05)", "FE", d(9, 30), d(10, 1), 3, "US-05"),
    ("6.4", "Viết API duyệt/từ chối hồ sơ, tự tạo tài khoản Intern và gửi email thông báo (US-06)", "BE", d(10, 1), d(10, 5), 5, "US-06"),
    ("6.5", "Dựng màn hình danh sách và duyệt hồ sơ đăng ký UI-03 (US-06)", "FE", d(10, 2), d(10, 5), 3, "US-06"),
    ("6.6", "Viết API /interns: tìm kiếm, lọc, phân trang, cập nhật hồ sơ, phân phòng ban (US-07)", "BE", d(10, 5), d(10, 6), 4, "US-07"),
    ("6.7", "Dựng màn hình Intern List UI-04 và Intern Detail UI-05 (US-07)", "FE", d(10, 5), d(10, 7), 4, "US-07"),
    ("6.8", "Viết API /mentors và phân Mentor cho Intern, tối đa 5 Intern/Mentor theo BR-04 (US-08)", "BE", d(10, 6), d(10, 7), 4, "US-08"),
    ("6.9", "Dựng màn hình Mentor List UI-06 và hộp thoại phân công Mentor (US-08)", "FE", d(10, 7), d(10, 8), 3, "US-08"),
    ("6.10", "Nghiệm thu nội bộ UI-02..UI-06 theo Acceptance Criteria US-05..US-08", "BA", d(10, 8), d(10, 8), 1, None),
    ("6.11", "Chạy TC-REG-01..03, TC-APR-01..02, TC-INT-01..03, TC-MEN-01..02 và lưu evidence", "TEST", d(10, 8), d(10, 9), 3, None),
    ("6.12", "Refine backlog Sprint 3: bổ sung Acceptance Criteria US-09..US-12 và cập nhật RTM", "BA", d(10, 9), d(10, 9), 1, None),

    ("7", "Sprint 3 - Giao việc, chấm công và báo cáo tuần", "PM", d(10, 12), d(10, 23), None, None),
    ("7.1", "Chốt Acceptance Criteria US-09..US-12, vòng đời Task và quy tắc chấm công BR-06..BR-10", "BA", d(10, 12), d(10, 13), 2, None),
    ("7.2", "Viết API POST /tasks và danh sách task theo Intern cho Mentor (US-09)", "BE", d(10, 12), d(10, 14), 4, "US-09"),
    ("7.3", "Dựng Task Board của Mentor UI-07 và form giao task có deadline (US-09)", "FE", d(10, 14), d(10, 15), 4, "US-09"),
    ("7.4", "Viết API GET /tasks/my-tasks, PUT /tasks/{id}/status và bình luận task (US-10)", "BE", d(10, 14), d(10, 15), 4, "US-10"),
    ("7.5", "Dựng màn hình My Tasks UI-08 và Task Detail kèm bình luận (US-10)", "FE", d(10, 15), d(10, 19), 4, "US-10"),
    ("7.6", "Viết API check-in/check-out /attendances, chặn chấm công trùng trong ngày BR-08 (US-11)", "BE", d(10, 16), d(10, 19), 3, "US-11"),
    ("7.7", "Dựng nút chấm công và bảng công tháng cho Intern, Mentor (US-11)", "FE", d(10, 19), d(10, 20), 3, "US-11"),
    ("7.8", "Viết API /weekly-reports: nộp, hạn chót Chủ nhật 23:59 theo BR-10, Mentor phản hồi (US-12)", "BE", d(10, 19), d(10, 21), 4, "US-12"),
    ("7.9", "Dựng màn hình Weekly Report UI-09 cho Intern và Mentor (US-12)", "FE", d(10, 20), d(10, 22), 4, "US-12"),
    ("7.10", "Nghiệm thu nội bộ UI-07..UI-09 theo Acceptance Criteria US-09..US-12", "BA", d(10, 22), d(10, 22), 1, None),
    ("7.11", "Chạy TC-TASK-01..05, TC-ATT-01..03, TC-RPT-01..03 và lưu evidence", "TEST", d(10, 22), d(10, 23), 3, None),
    ("7.12", "Refine backlog Sprint 4: bổ sung Acceptance Criteria US-13..US-16 và cập nhật RTM", "BA", d(10, 23), d(10, 23), 1, None),

    ("8", "Sprint 4 - Đánh giá, tiến độ, dashboard và xuất kết quả", "PM", d(10, 26), d(11, 6), None, None),
    ("8.1", "Chốt 5 tiêu chí đánh giá thang 10, công thức tính tiến độ và chỉ số dashboard", "BA", d(10, 26), d(10, 27), 2, None),
    ("8.2", "Viết API /evaluations giữa kỳ và cuối kỳ, chỉ Mentor phụ trách được chấm BR-12 (US-13)", "BE", d(10, 26), d(10, 28), 4, "US-13"),
    ("8.3", "Dựng form đánh giá UI-12 cho Mentor và trang xem đánh giá cho Intern (US-13)", "FE", d(10, 28), d(10, 29), 3, "US-13"),
    ("8.4", "Viết service tính tiến độ: 50% task DONE + 25% báo cáo tuần + 25% chuyên cần (US-14)", "BE", d(10, 28), d(10, 30), 3, "US-14"),
    ("8.5", "Hiển thị thanh tiến độ trên Intern Detail và Intern Dashboard (US-14)", "FE", d(10, 30), d(11, 2), 2, "US-14"),
    ("8.6", "Viết API /dashboard/admin, /dashboard/mentor, /dashboard/intern tổng hợp số liệu (US-15)", "BE", d(11, 2), d(11, 3), 4, "US-15"),
    ("8.7", "Dựng 3 dashboard bằng Recharts: số Intern, tiến độ, task quá hạn, điểm trung bình (US-15)", "FE", d(11, 2), d(11, 4), 5, "US-15"),
    ("8.8", "Xuất kết quả cuối kỳ ra Excel (Apache POI) và PDF, chuyển trạng thái COMPLETED (US-16)", "BE", d(11, 3), d(11, 5), 4, "US-16"),
    ("8.9", "Thêm nút xuất file và thao tác kết thúc kỳ thực tập trên giao diện Admin (US-16)", "FE", d(11, 4), d(11, 5), 2, "US-16"),
    ("8.10", "Kiểm tra số liệu dashboard và file kết quả khớp BR-11..BR-15", "BA", d(11, 5), d(11, 5), 1, None),
    ("8.11", "Chạy TC-EVA-01..03, TC-PRG-01, TC-DSH-01..02, TC-EXP-01..02 và lưu evidence", "TEST", d(11, 5), d(11, 6), 3, None),
    ("8.12", "Viết 8 kịch bản UAT UAT-01..UAT-08 và chuẩn bị dữ liệu nghiệp vụ", "BA", d(11, 6), d(11, 6), 2, None),

    ("9", "Kiểm thử và đảm bảo chất lượng", "TEST", d(9, 14), d(11, 13), None, None),
    ("9.1", "Viết Test Plan: phạm vi, môi trường, mức độ nghiêm trọng S1..S4, tiêu chí vào/ra", "TEST", d(9, 14), d(9, 16), 3, None),
    ("9.2", "Viết 40 test case TC-AUTH..TC-EXP trên Excel và dựng bộ dữ liệu kiểm thử", "TEST", d(9, 16), d(9, 25), 6, None),
    ("9.3", "Xây Postman collection và Newman để chạy hồi quy API tự động", "TEST", d(9, 21), d(9, 25), 3, None),
    ("9.4", "Kiểm thử API và giao diện cho từng User Story khi chuyển sang IN TESTING", "TEST", d(9, 28), d(11, 6), 8, None),
    ("9.5", "Ghi Bug lên Jira kèm severity, bước tái hiện, evidence và xác minh bản vá", "TEST", d(9, 28), d(11, 13), 5, None),
    ("9.6", "Tự động hóa 5 luồng chính bằng Selenium WebDriver", "TEST", d(10, 26), d(11, 6), 5, None),
    ("9.7", "Chạy hồi quy toàn bộ luồng Critical và High bằng Newman + Selenium + kiểm thử tay", "TEST", d(11, 9), d(11, 11), 4, None),

    ("10", "Sprint 5 - Ổn định, nghiệm thu và phát hành", "PM", d(11, 9), d(11, 20), None, None),
    ("10.1", "Sửa dứt điểm bug S1, S2 phía backend và cập nhật trạng thái trên Jira", "BE", d(11, 9), d(11, 12), 5, None),
    ("10.2", "Sửa dứt điểm bug S1, S2 phía frontend và cập nhật trạng thái trên Jira", "FE", d(11, 9), d(11, 12), 4, None),
    ("10.3", "Tối ưu truy vấn chậm và rà soát bảo mật cơ bản theo OWASP Top 10", "BE", d(11, 10), d(11, 11), 2, None),
    ("10.4", "Tạo nhánh release, gắn tag v1.0.0 và chạy thử migration Flyway trên bản backup", "BE", d(11, 11), d(11, 13), 2, None),
    ("10.5", "Triển khai môi trường UAT bằng Docker Compose và nạp dữ liệu gần thực tế", "BE", d(11, 12), d(11, 13), 2, None),
    ("10.6", "Điều phối UAT: chạy 8 kịch bản UAT-01..UAT-08 với người dùng đại diện", "BA", d(11, 16), d(11, 17), 3, None),
    ("10.7", "Ghi nhận kết quả UAT, phân loại lỗi S1..S4 và xác minh bản vá", "TEST", d(11, 16), d(11, 17), 3, None),
    ("10.8", "Tổng hợp phản hồi UAT, cập nhật RTM và lấy biên bản UAT Sign-off", "BA", d(11, 17), d(11, 18), 2, None),
    ("10.9", "Viết Release Notes, Deployment Guide, cập nhật Swagger và README", "BE", d(11, 18), d(11, 19), 3, None),
    ("10.10", "Viết User Manual cho 3 nhóm người dùng kèm ảnh màn hình UI-01..UI-12", "BA", d(11, 18), d(11, 19), 3, None),
    ("10.11", "Sao lưu database, repository và đóng gói mã nguồn bàn giao", "BE", d(11, 19), d(11, 19), 1, None),
    ("10.12", "Trình bày nghiệm thu: demo 15 phút, evidence Jira/GitHub, so sánh baseline và thực tế", "PM", d(11, 20), d(11, 20), 3, None),

    ("11", "Mốc kiểm soát dự án", "PM", d(9, 11), d(11, 20), None, None),
    ("11.1", "M1 - Chốt baseline phạm vi, yêu cầu và thiết kế", "PM", d(9, 11), d(9, 11), 0, None),
    ("11.2", "M2 - Hoàn thành đăng nhập, phân quyền và quản trị", "PM", d(9, 25), d(9, 25), 0, None),
    ("11.3", "M3 - Hoàn thành hồ sơ Intern, Mentor và phân công", "PM", d(10, 9), d(10, 9), 0, None),
    ("11.4", "M4 - Hoàn thành giao việc, chấm công và báo cáo tuần", "PM", d(10, 23), d(10, 23), 0, None),
    ("11.5", "M5 - Feature Complete: đánh giá, tiến độ, dashboard, xuất kết quả", "PM", d(11, 6), d(11, 6), 0, None),
    ("11.6", "M6 - Nghiệm thu và phát hành IMS v1.0.0", "PM", d(11, 20), d(11, 20), 0, None),
]

MILESTONE_GROUP = "11"
TEST_OWNER = "TEST"
CONTINUOUS_TASKS = ["1.8", "1.9", "2.9", "9.4", "9.5"]
CRITICAL_PATH = ["1.1", "2.2", "2.7", "3.5", "5.2", "5.4", "6.2", "6.4", "6.8",
                 "7.2", "7.4", "7.8", "8.4", "8.6", "8.8", "9.7", "10.1", "10.4", "10.6", "10.12"]

ROLE_NAMES = {
    "PM": "Project Manager",
    "BA": "Business Analyst",
    "FE": "Frontend Developer",
    "BE": "Backend Developer",
    "TEST": "Tester / QA",
}


def is_group(task_id):
    return "." not in task_id


def children(group_id):
    return [t for t in WBS if not is_group(t[0]) and t[0].split(".")[0] == group_id]


def workdays(start, end):
    n, cur = 0, start
    while cur <= end:
        if cur.weekday() < 5:
            n += 1
        cur += timedelta(days=1)
    return n


# ------------------------------------------------------------- Requirements
ACTORS = [
    ("Ứng viên (Guest)", "Người chưa có tài khoản, gửi đơn đăng ký thực tập kèm CV."),
    ("Admin (HR)", "Quản trị hệ thống: duyệt hồ sơ, quản lý Intern, Mentor, phòng ban, kỳ thực tập, xem toàn bộ tiến độ."),
    ("Mentor", "Nhân viên hướng dẫn: giao task, nhận xét, phản hồi báo cáo tuần, đánh giá Intern được giao."),
    ("Intern", "Thực tập sinh: xem và cập nhật task, chấm công, nộp báo cáo tuần, xem đánh giá và tiến độ."),
]

FUNCTIONAL = [
    ("FR-01", "Đăng nhập bằng email và mật khẩu, cấp JWT có thời hạn 8 giờ", "Tất cả", "US-01"),
    ("FR-02", "Đăng xuất và hủy phiên làm việc phía client", "Tất cả", "US-01"),
    ("FR-03", "Đổi mật khẩu cá nhân, mật khẩu mới tối thiểu 8 ký tự gồm chữ và số", "Tất cả", "US-03"),
    ("FR-04", "Phân quyền theo 3 role Admin, Mentor, Intern trên cả API và giao diện", "Hệ thống", "US-02"),
    ("FR-05", "Admin tạo, sửa, khóa/mở tài khoản người dùng", "Admin", "US-03"),
    ("FR-06", "Admin thêm, sửa, xóa phòng ban", "Admin", "US-04"),
    ("FR-07", "Ứng viên gửi đơn đăng ký thực tập kèm CV PDF", "Guest", "US-05"),
    ("FR-08", "Admin duyệt hoặc từ chối đơn đăng ký kèm lý do", "Admin", "US-06"),
    ("FR-09", "Tự tạo tài khoản Intern và gửi email khi đơn được duyệt", "Hệ thống", "US-06"),
    ("FR-10", "Admin tìm kiếm, lọc, phân trang danh sách Intern", "Admin", "US-07"),
    ("FR-11", "Admin xem và cập nhật hồ sơ Intern (trường, ngành, thời gian thực tập)", "Admin", "US-07"),
    ("FR-12", "Admin phân Intern vào phòng ban", "Admin", "US-07"),
    ("FR-13", "Admin quản lý danh sách Mentor theo phòng ban", "Admin", "US-08"),
    ("FR-14", "Admin phân công Mentor cho Intern", "Admin", "US-08"),
    ("FR-15", "Mentor xem danh sách Intern được giao", "Mentor", "US-08"),
    ("FR-16", "Mentor tạo và giao task kèm mô tả, độ ưu tiên, deadline", "Mentor", "US-09"),
    ("FR-17", "Intern xem danh sách task của mình", "Intern", "US-10"),
    ("FR-18", "Intern cập nhật trạng thái task TODO, IN_PROGRESS, REVIEW", "Intern", "US-10"),
    ("FR-19", "Mentor nhận xét task, chuyển DONE hoặc trả lại IN_PROGRESS", "Mentor", "US-10"),
    ("FR-20", "Intern check-in và check-out hằng ngày", "Intern", "US-11"),
    ("FR-21", "Mentor, Admin xem bảng công theo tháng", "Mentor, Admin", "US-11"),
    ("FR-22", "Intern nộp báo cáo tuần", "Intern", "US-12"),
    ("FR-23", "Mentor phản hồi báo cáo tuần", "Mentor", "US-12"),
    ("FR-24", "Mentor đánh giá Intern giữa kỳ và cuối kỳ theo 5 tiêu chí", "Mentor", "US-13"),
    ("FR-25", "Intern xem kết quả đánh giá của mình", "Intern", "US-13"),
    ("FR-26", "Tính và hiển thị % tiến độ thực tập của từng Intern", "Hệ thống", "US-14"),
    ("FR-27", "Dashboard thống kê riêng cho Admin, Mentor, Intern", "Tất cả", "US-15"),
    ("FR-28", "Xuất kết quả cuối kỳ ra Excel và PDF", "Admin", "US-16"),
    ("FR-29", "Kết thúc kỳ thực tập, chuyển Intern sang COMPLETED và khóa chỉnh sửa", "Admin", "US-16"),
    ("FR-30", "Thông báo trong hệ thống khi có task mới, sắp hết hạn, được đánh giá", "Tất cả", "US-09"),
]

NON_FUNCTIONAL = [
    ("NFR-01", "Hiệu năng", "95% request API phản hồi dưới 1 giây với 50 người dùng đồng thời"),
    ("NFR-02", "Bảo mật", "Mật khẩu băm BCrypt; mọi API trừ /auth/login và /applications yêu cầu JWT"),
    ("NFR-03", "Phân quyền", "Truy cập sai quyền trả HTTP 403, không lộ dữ liệu của Intern khác"),
    ("NFR-04", "Khả dụng", "Hệ thống hoạt động 99% trong giờ hành chính trong thời gian UAT"),
    ("NFR-05", "Tương thích", "Chạy đúng trên Chrome, Edge, Firefox bản mới nhất; giao diện responsive từ 1280px"),
    ("NFR-06", "Dễ dùng", "Người dùng mới hoàn thành thao tác chính trong 3 lần nhấp từ dashboard"),
    ("NFR-07", "Toàn vẹn dữ liệu", "Ràng buộc khóa ngoại, UNIQUE email; xóa mềm cho dữ liệu nghiệp vụ"),
    ("NFR-08", "Kiểm toán", "Ghi created_at, updated_at, created_by cho mọi bản ghi nghiệp vụ"),
    ("NFR-09", "Bảo trì", "Độ phủ unit test tầng Service tối thiểu 60%; code theo chuẩn Google Java Style"),
    ("NFR-10", "Sao lưu", "Sao lưu MySQL hằng ngày, khôi phục được trong 30 phút"),
]

BUSINESS_RULES = [
    ("BR-01", "Email đăng ký là duy nhất; một ứng viên chỉ có 1 đơn ở trạng thái PENDING"),
    ("BR-02", "CV chỉ nhận định dạng PDF, dung lượng tối đa 5 MB"),
    ("BR-03", "Chỉ Admin được duyệt/từ chối đơn; từ chối bắt buộc nhập lý do"),
    ("BR-04", "Mỗi Mentor hướng dẫn tối đa 5 Intern cùng lúc"),
    ("BR-05", "Intern phải được phân phòng ban trước khi phân Mentor; Mentor phải cùng phòng ban"),
    ("BR-06", "Chỉ Mentor phụ trách mới giao task cho Intern đó; deadline không được ở quá khứ"),
    ("BR-07", "Intern chỉ cập nhật task của chính mình; chỉ Mentor chuyển task sang DONE"),
    ("BR-08", "Mỗi ngày làm việc chỉ 1 lần check-in và 1 lần check-out; check-in sau 8:30 tính đi muộn"),
    ("BR-09", "Bảng công đã được Mentor xác nhận thì Intern không sửa được"),
    ("BR-10", "Báo cáo tuần hạn chót Chủ nhật 23:59; nộp muộn vẫn nhận nhưng gắn cờ LATE"),
    ("BR-11", "Tiến độ = 50% tỉ lệ task DONE + 25% tỉ lệ báo cáo đúng hạn + 25% tỉ lệ chuyên cần"),
    ("BR-12", "Chỉ Mentor phụ trách được đánh giá; mỗi Intern 1 đánh giá giữa kỳ và 1 đánh giá cuối kỳ"),
    ("BR-13", "Điểm tổng kết = trung bình 5 tiêu chí; xếp loại Xuất sắc >= 9, Giỏi >= 8, Khá >= 6.5, Đạt >= 5"),
    ("BR-14", "Chỉ kết thúc kỳ thực tập khi Intern đã có đánh giá cuối kỳ"),
    ("BR-15", "Sau khi COMPLETED, dữ liệu của Intern chỉ được xem, không được sửa"),
]

USE_CASES = [
    ("UC-01", "Đăng nhập / đăng xuất", "Admin, Mentor, Intern"),
    ("UC-02", "Quản lý tài khoản người dùng", "Admin"),
    ("UC-03", "Quản lý phòng ban", "Admin"),
    ("UC-04", "Đăng ký thực tập", "Ứng viên"),
    ("UC-05", "Duyệt hồ sơ đăng ký", "Admin"),
    ("UC-06", "Quản lý hồ sơ Intern", "Admin"),
    ("UC-07", "Phân công Mentor", "Admin"),
    ("UC-08", "Giao và theo dõi task", "Mentor, Intern"),
    ("UC-09", "Chấm công", "Intern, Mentor"),
    ("UC-10", "Nộp và phản hồi báo cáo tuần", "Intern, Mentor"),
    ("UC-11", "Đánh giá Intern", "Mentor, Intern"),
    ("UC-12", "Xem dashboard, tiến độ và xuất kết quả", "Admin, Mentor, Intern"),
]

# (id, epic group, SP, priority, story, acceptance criteria list)
USER_STORIES = [
    ("US-01", "5", 5, "Highest", "Là người dùng, tôi muốn đăng nhập bằng email và mật khẩu để truy cập chức năng theo vai trò của mình.",
     ["Given tài khoản hợp lệ đang hoạt động, When nhập đúng email và mật khẩu, Then hệ thống cấp JWT và chuyển tới dashboard đúng role.",
      "Given mật khẩu sai, When đăng nhập, Then hiển thị 'Email hoặc mật khẩu không đúng' và không cấp token.",
      "Given tài khoản bị khóa, When đăng nhập, Then hiển thị 'Tài khoản đã bị khóa'."]),
    ("US-02", "5", 3, "Highest", "Là Admin, tôi muốn hệ thống phân quyền theo role để mỗi người chỉ thấy đúng chức năng của mình.",
     ["Given Intern đã đăng nhập, When truy cập /admin, Then hệ thống trả trang 403 Access Denied.",
      "Given Mentor đã đăng nhập, When gọi API của Admin, Then API trả HTTP 403.",
      "Given người dùng đăng nhập, When mở menu, Then chỉ hiển thị mục thuộc role của họ."]),
    ("US-03", "5", 3, "High", "Là Admin, tôi muốn quản lý tài khoản người dùng để kiểm soát ai được sử dụng hệ thống.",
     ["Given Admin mở UI-10, When tạo tài khoản với email trùng, Then báo lỗi 'Email đã tồn tại'.",
      "Given tài khoản đang hoạt động, When Admin khóa, Then người đó không đăng nhập được nữa.",
      "Given người dùng đã đăng nhập, When đổi mật khẩu đúng quy tắc, Then lần đăng nhập sau dùng mật khẩu mới."]),
    ("US-04", "5", 2, "High", "Là Admin, tôi muốn quản lý phòng ban để phân Intern về đúng nơi làm việc.",
     ["Given Admin mở UI-11, When thêm phòng ban với tên hợp lệ, Then phòng ban xuất hiện trong danh sách.",
      "Given phòng ban còn Intern đang thực tập, When Admin xóa, Then hệ thống từ chối và báo lý do."]),
    ("US-05", "6", 3, "High", "Là ứng viên, tôi muốn gửi đơn đăng ký thực tập trực tuyến kèm CV để công ty xem xét.",
     ["Given form UI-02, When gửi đủ thông tin và CV PDF <= 5 MB, Then đơn được lưu trạng thái PENDING.",
      "Given CV không phải PDF hoặc > 5 MB, When gửi, Then báo lỗi và không lưu đơn.",
      "Given email đã có đơn PENDING, When gửi đơn mới, Then báo 'Bạn đã có đơn đang chờ duyệt'."]),
    ("US-06", "6", 3, "High", "Là Admin, tôi muốn duyệt hoặc từ chối đơn đăng ký để tiếp nhận Intern phù hợp.",
     ["Given đơn PENDING, When Admin duyệt, Then tạo tài khoản Intern và gửi email thông tin đăng nhập.",
      "Given đơn PENDING, When Admin từ chối mà không nhập lý do, Then hệ thống không cho lưu.",
      "Given đơn đã xử lý, When mở lại, Then chỉ xem được, không duyệt lại."]),
    ("US-07", "6", 3, "Medium", "Là Admin, tôi muốn quản lý hồ sơ Intern để nắm thông tin và phân phòng ban.",
     ["Given danh sách UI-04, When lọc theo phòng ban và trạng thái, Then chỉ hiển thị Intern khớp điều kiện.",
      "Given Intern Detail UI-05, When Admin cập nhật thời gian thực tập, Then dữ liệu được lưu và hiển thị ngay.",
      "Given Intern chưa có phòng ban, When Admin phân phòng ban, Then Intern xuất hiện trong danh sách của phòng ban đó."]),
    ("US-08", "6", 5, "High", "Là Admin, tôi muốn phân công Mentor cho Intern để mỗi Intern có người hướng dẫn.",
     ["Given Mentor đang hướng dẫn 5 Intern, When phân thêm Intern, Then hệ thống từ chối theo BR-04.",
      "Given Mentor khác phòng ban với Intern, When phân công, Then hệ thống từ chối theo BR-05.",
      "Given phân công thành công, When Mentor đăng nhập, Then thấy Intern trong danh sách 'Intern của tôi'."]),
    ("US-09", "7", 5, "High", "Là Mentor, tôi muốn giao task cho Intern để phân công công việc thực tập.",
     ["Given Mentor phụ trách Intern, When tạo task có tiêu đề và deadline tương lai, Then task ở trạng thái TODO và Intern nhận thông báo.",
      "Given deadline ở quá khứ, When lưu task, Then báo lỗi.",
      "Given Mentor không phụ trách Intern, When giao task, Then API trả HTTP 403."]),
    ("US-10", "7", 3, "High", "Là Intern, tôi muốn xem task được giao và cập nhật tiến độ để Mentor theo dõi.",
     ["Given Intern đã đăng nhập, When mở My Tasks, Then hiển thị các task Mentor giao cho Intern đó.",
      "Given task của Intern khác, When Intern sửa, Then API trả HTTP 403.",
      "Given task ở REVIEW, When Mentor duyệt, Then task chuyển DONE; khi trả lại thì về IN_PROGRESS kèm nhận xét."]),
    ("US-11", "7", 3, "Medium", "Là Intern, tôi muốn chấm công hằng ngày để ghi nhận chuyên cần.",
     ["Given chưa check-in hôm nay, When nhấn Check-in, Then lưu giờ vào; sau 8:30 gắn cờ đi muộn.",
      "Given đã check-in hôm nay, When nhấn Check-in lần nữa, Then hệ thống từ chối theo BR-08.",
      "Given Mentor mở bảng công, When chọn tháng, Then thấy số ngày công, đi muộn, vắng của từng Intern."]),
    ("US-12", "7", 5, "High", "Là Intern, tôi muốn nộp báo cáo tuần để Mentor nắm được công việc đã làm.",
     ["Given tuần hiện tại chưa có báo cáo, When Intern nộp, Then báo cáo lưu trạng thái SUBMITTED.",
      "Given quá Chủ nhật 23:59, When Intern nộp, Then báo cáo được nhận và gắn cờ LATE.",
      "Given báo cáo đã nộp, When Mentor phản hồi, Then Intern thấy phản hồi trên UI-09."]),
    ("US-13", "8", 5, "High", "Là Mentor, tôi muốn đánh giá Intern giữa kỳ và cuối kỳ để ghi nhận kết quả thực tập.",
     ["Given Mentor phụ trách, When chấm 5 tiêu chí thang 10 và nhận xét, Then đánh giá được lưu và Intern xem được.",
      "Given Intern đã có đánh giá cuối kỳ, When Mentor tạo thêm đánh giá cuối kỳ, Then hệ thống từ chối theo BR-12.",
      "Given điểm ngoài khoảng 0..10, When lưu, Then báo lỗi."]),
    ("US-14", "8", 3, "Medium", "Là Admin/Mentor, tôi muốn xem % tiến độ thực tập để phát hiện Intern chậm tiến độ.",
     ["Given Intern có task, báo cáo, chấm công, When mở Intern Detail, Then hiển thị % tiến độ tính theo BR-11.",
      "Given tiến độ dưới 50% khi đã qua nửa kỳ, When mở danh sách, Then Intern được đánh dấu cảnh báo."]),
    ("US-15", "8", 5, "Medium", "Là người dùng, tôi muốn xem dashboard thống kê để nắm nhanh tình hình thực tập.",
     ["Given Admin đăng nhập, When mở dashboard, Then thấy tổng Intern theo trạng thái, theo phòng ban và số task quá hạn.",
      "Given Mentor đăng nhập, When mở dashboard, Then thấy Intern của mình, task chờ duyệt, báo cáo chưa phản hồi.",
      "Given Intern đăng nhập, When mở dashboard, Then thấy task sắp hết hạn và % tiến độ của bản thân."]),
    ("US-16", "8", 3, "Medium", "Là Admin, tôi muốn xuất kết quả cuối kỳ và kết thúc kỳ thực tập để lưu hồ sơ và cấp xác nhận.",
     ["Given Intern đã có đánh giá cuối kỳ, When Admin xuất file, Then tải về Excel/PDF đúng điểm, xếp loại, nhận xét.",
      "Given Intern chưa có đánh giá cuối kỳ, When Admin kết thúc kỳ, Then hệ thống từ chối theo BR-14.",
      "Given Intern đã COMPLETED, When bất kỳ ai sửa dữ liệu, Then hệ thống từ chối theo BR-15."]),
]

US_TITLES = {
    "US-01": "Đăng nhập / đăng xuất bằng JWT",
    "US-02": "Phân quyền theo 3 role Admin, Mentor, Intern",
    "US-03": "Quản lý tài khoản người dùng",
    "US-04": "Quản lý phòng ban",
    "US-05": "Đăng ký thực tập trực tuyến kèm CV",
    "US-06": "Duyệt / từ chối hồ sơ đăng ký",
    "US-07": "Quản lý hồ sơ thực tập sinh",
    "US-08": "Quản lý và phân công Mentor",
    "US-09": "Mentor giao task cho Intern",
    "US-10": "Intern xem và cập nhật task",
    "US-11": "Chấm công check-in / check-out",
    "US-12": "Nộp và phản hồi báo cáo tuần",
    "US-13": "Mentor đánh giá Intern giữa kỳ, cuối kỳ",
    "US-14": "Theo dõi tiến độ thực tập",
    "US-15": "Dashboard thống kê theo role",
    "US-16": "Xuất kết quả cuối kỳ và kết thúc kỳ thực tập",
}

SCREENS = [
    ("UI-01", "Login", "Tất cả"), ("UI-02", "Đăng ký thực tập", "Ứng viên"),
    ("UI-03", "Duyệt hồ sơ đăng ký", "Admin"), ("UI-04", "Intern List", "Admin, Mentor"),
    ("UI-05", "Intern Detail", "Admin, Mentor"), ("UI-06", "Mentor List + phân công", "Admin"),
    ("UI-07", "Task Board (Mentor)", "Mentor"), ("UI-08", "My Tasks + Task Detail", "Intern"),
    ("UI-09", "Weekly Report", "Intern, Mentor"), ("UI-10", "Quản lý tài khoản", "Admin"),
    ("UI-11", "Quản lý phòng ban", "Admin"), ("UI-12", "Evaluation", "Mentor, Intern"),
    ("UI-13", "Dashboard (3 biến thể theo role)", "Tất cả"), ("UI-14", "Profile / đổi mật khẩu", "Tất cả"),
]

API = [
    ("POST", "/api/v1/auth/login", "Đăng nhập, trả JWT", "Public"),
    ("POST", "/api/v1/auth/logout", "Đăng xuất", "Đã đăng nhập"),
    ("GET", "/api/v1/auth/me", "Thông tin người dùng hiện tại", "Đã đăng nhập"),
    ("PUT", "/api/v1/auth/password", "Đổi mật khẩu", "Đã đăng nhập"),
    ("GET/POST", "/api/v1/users", "Danh sách / tạo tài khoản", "Admin"),
    ("PUT", "/api/v1/users/{id}", "Sửa tài khoản", "Admin"),
    ("PATCH", "/api/v1/users/{id}/lock", "Khóa / mở tài khoản", "Admin"),
    ("GET/POST", "/api/v1/departments", "Danh sách / thêm phòng ban", "Admin"),
    ("PUT/DELETE", "/api/v1/departments/{id}", "Sửa / xóa phòng ban", "Admin"),
    ("POST", "/api/v1/applications", "Gửi đơn đăng ký kèm CV", "Public"),
    ("GET", "/api/v1/applications", "Danh sách đơn đăng ký", "Admin"),
    ("POST", "/api/v1/applications/{id}/approve", "Duyệt đơn, tạo tài khoản Intern", "Admin"),
    ("POST", "/api/v1/applications/{id}/reject", "Từ chối đơn kèm lý do", "Admin"),
    ("GET", "/api/v1/interns", "Tìm kiếm, lọc, phân trang Intern", "Admin, Mentor"),
    ("GET/PUT", "/api/v1/interns/{id}", "Xem / sửa hồ sơ Intern", "Admin"),
    ("PATCH", "/api/v1/interns/{id}/department", "Phân phòng ban", "Admin"),
    ("PATCH", "/api/v1/interns/{id}/mentor", "Phân công Mentor", "Admin"),
    ("GET", "/api/v1/mentors", "Danh sách Mentor", "Admin"),
    ("GET", "/api/v1/mentors/me/interns", "Intern của tôi", "Mentor"),
    ("POST", "/api/v1/tasks", "Giao task", "Mentor"),
    ("GET", "/api/v1/tasks?internId=", "Task theo Intern", "Mentor"),
    ("GET", "/api/v1/tasks/my-tasks", "Task của tôi", "Intern"),
    ("PUT", "/api/v1/tasks/{id}/status", "Cập nhật trạng thái task", "Intern, Mentor"),
    ("GET/POST", "/api/v1/tasks/{id}/comments", "Bình luận task", "Mentor, Intern"),
    ("POST", "/api/v1/attendances/check-in", "Check-in", "Intern"),
    ("POST", "/api/v1/attendances/check-out", "Check-out", "Intern"),
    ("GET", "/api/v1/attendances?month=", "Bảng công theo tháng", "Mentor, Admin, Intern"),
    ("POST", "/api/v1/reports", "Nộp báo cáo tuần", "Intern"),
    ("GET", "/api/v1/reports?internId=", "Danh sách báo cáo", "Mentor, Intern"),
    ("POST", "/api/v1/reports/{id}/feedback", "Phản hồi báo cáo", "Mentor"),
    ("POST", "/api/v1/evaluations", "Đánh giá Intern", "Mentor"),
    ("GET", "/api/v1/evaluations?internId=", "Xem đánh giá", "Mentor, Intern, Admin"),
    ("GET", "/api/v1/interns/{id}/progress", "% tiến độ thực tập", "Admin, Mentor, Intern"),
    ("GET", "/api/v1/dashboard/{role}", "Số liệu dashboard", "Theo role"),
    ("GET", "/api/v1/results/export?format=xlsx|pdf", "Xuất kết quả cuối kỳ", "Admin"),
    ("POST", "/api/v1/interns/{id}/complete", "Kết thúc kỳ thực tập", "Admin"),
]

TABLES = [
    ("users", "id, full_name, email (UNIQUE), password_hash, role (ADMIN/MENTOR/INTERN), phone, is_active, created_at, updated_at"),
    ("departments", "id, name (UNIQUE), description, created_at"),
    ("internship_applications", "id, full_name, email, phone, university, major, gpa, cv_path, desired_department_id (FK), status (PENDING/APPROVED/REJECTED), reject_reason, reviewed_by (FK users), reviewed_at, created_at"),
    ("mentors", "id, user_id (FK users, UNIQUE), department_id (FK), position, max_interns (mặc định 5)"),
    ("interns", "id, user_id (FK users, UNIQUE), application_id (FK), department_id (FK), mentor_id (FK mentors), university, major, start_date, end_date, status (ACTIVE/COMPLETED/TERMINATED)"),
    ("tasks", "id, title, description, priority, intern_id (FK), mentor_id (FK), status (TODO/IN_PROGRESS/REVIEW/DONE), deadline, completed_at, created_at"),
    ("task_comments", "id, task_id (FK), author_id (FK users), content, created_at"),
    ("attendances", "id, intern_id (FK), work_date, check_in, check_out, is_late, confirmed_by (FK users); UNIQUE(intern_id, work_date)"),
    ("weekly_reports", "id, intern_id (FK), week_start, content, next_plan, status (SUBMITTED/LATE/REVIEWED), mentor_feedback, submitted_at; UNIQUE(intern_id, week_start)"),
    ("evaluations", "id, intern_id (FK), mentor_id (FK), type (MIDTERM/FINAL), attitude, knowledge, skill, teamwork, result, total_score, grade, comment, created_at; UNIQUE(intern_id, type)"),
    ("notifications", "id, user_id (FK), title, content, is_read, link, created_at"),
    ("audit_logs", "id, actor_id (FK users), action, entity, entity_id, old_value, new_value, created_at"),
]

TEST_CASES = [
    ("TC-AUTH-01", "Đăng nhập đúng email và mật khẩu", "Đăng nhập thành công, chuyển tới dashboard đúng role", "US-01", "High"),
    ("TC-AUTH-02", "Đăng nhập sai mật khẩu", "Báo 'Email hoặc mật khẩu không đúng'", "US-01", "High"),
    ("TC-AUTH-03", "Đăng nhập tài khoản bị khóa", "Báo 'Tài khoản đã bị khóa'", "US-01", "Medium"),
    ("TC-AUTH-04", "Gọi API khi token hết hạn", "HTTP 401, chuyển về trang Login", "US-01", "High"),
    ("TC-RBAC-01", "Intern truy cập trang Admin", "Access Denied 403", "US-02", "Critical"),
    ("TC-RBAC-02", "Mentor gọi API /users", "HTTP 403", "US-02", "Critical"),
    ("TC-RBAC-03", "Menu hiển thị theo role", "Mỗi role chỉ thấy mục của mình", "US-02", "Medium"),
    ("TC-USR-01", "Tạo tài khoản với email trùng", "Báo 'Email đã tồn tại'", "US-03", "Medium"),
    ("TC-USR-02", "Khóa tài khoản rồi đăng nhập", "Không đăng nhập được", "US-03", "High"),
    ("TC-DEP-01", "Xóa phòng ban còn Intern", "Từ chối, hiển thị lý do", "US-04", "Medium"),
    ("TC-REG-01", "Gửi đơn đăng ký hợp lệ", "Đơn lưu trạng thái PENDING", "US-05", "High"),
    ("TC-REG-02", "Gửi CV định dạng .docx", "Báo lỗi chỉ nhận PDF", "US-05", "Medium"),
    ("TC-REG-03", "Gửi CV dung lượng 6 MB", "Báo lỗi vượt 5 MB", "US-05", "Medium"),
    ("TC-APR-01", "Admin duyệt đơn", "Tạo tài khoản Intern, gửi email", "US-06", "High"),
    ("TC-APR-02", "Từ chối đơn không nhập lý do", "Không cho lưu", "US-06", "Medium"),
    ("TC-INT-01", "Lọc Intern theo phòng ban", "Chỉ hiển thị Intern của phòng ban đó", "US-07", "Medium"),
    ("TC-INT-02", "Cập nhật thời gian thực tập", "Lưu và hiển thị đúng", "US-07", "Low"),
    ("TC-INT-03", "Phân phòng ban cho Intern", "Intern thuộc phòng ban mới", "US-07", "Medium"),
    ("TC-MEN-01", "Phân Intern thứ 6 cho một Mentor", "Từ chối theo BR-04", "US-08", "High"),
    ("TC-MEN-02", "Phân Mentor khác phòng ban", "Từ chối theo BR-05", "US-08", "Medium"),
    ("TC-TASK-01", "Mentor giao task cho Intern của mình", "Intern nhận được task và thông báo", "US-09", "Critical"),
    ("TC-TASK-02", "Giao task deadline ở quá khứ", "Báo lỗi", "US-09", "Medium"),
    ("TC-TASK-03", "Mentor giao task cho Intern không phụ trách", "HTTP 403", "US-09", "High"),
    ("TC-TASK-04", "Intern sửa task của người khác", "Không cho phép (403)", "US-10", "Critical"),
    ("TC-TASK-05", "Mentor trả lại task ở REVIEW", "Task về IN_PROGRESS kèm nhận xét", "US-10", "Medium"),
    ("TC-ATT-01", "Check-in lúc 8:45", "Lưu và gắn cờ đi muộn", "US-11", "Medium"),
    ("TC-ATT-02", "Check-in 2 lần trong ngày", "Từ chối theo BR-08", "US-11", "High"),
    ("TC-ATT-03", "Xem bảng công theo tháng", "Đúng số ngày công, đi muộn, vắng", "US-11", "Medium"),
    ("TC-RPT-01", "Intern nộp báo cáo tuần", "Lưu thành công, trạng thái SUBMITTED", "US-12", "High"),
    ("TC-RPT-02", "Nộp báo cáo sau Chủ nhật 23:59", "Lưu và gắn cờ LATE", "US-12", "Medium"),
    ("TC-RPT-03", "Mentor phản hồi báo cáo", "Intern thấy phản hồi", "US-12", "Medium"),
    ("TC-EVA-01", "Mentor đánh giá Intern", "Lưu điểm, tính tổng và xếp loại đúng BR-13", "US-13", "Critical"),
    ("TC-EVA-02", "Tạo đánh giá cuối kỳ lần 2", "Từ chối theo BR-12", "US-13", "High"),
    ("TC-EVA-03", "Nhập điểm 11", "Báo lỗi điểm ngoài 0..10", "US-13", "Medium"),
    ("TC-PRG-01", "Tính % tiến độ", "Khớp công thức BR-11", "US-14", "High"),
    ("TC-DSH-01", "Dashboard Admin", "Số liệu khớp dữ liệu trong DB", "US-15", "Medium"),
    ("TC-DSH-02", "Dashboard Intern", "Chỉ hiện dữ liệu của chính Intern", "US-15", "High"),
    ("TC-EXP-01", "Xuất kết quả Excel", "File đúng điểm, xếp loại, nhận xét", "US-16", "High"),
    ("TC-EXP-02", "Kết thúc kỳ khi chưa có đánh giá cuối kỳ", "Từ chối theo BR-14", "US-16", "High"),
    ("TC-SEC-01", "Người không có quyền vào trang Admin qua URL", "Access Denied", "US-02", "Critical"),
]

RISKS = [
    ("R-01", "Một người đảm nhận 5 vai trò dẫn tới quá tải, trễ tiến độ", "Cao", "Cao",
     "Time-box theo vai trò, giới hạn WIP = 2 trên Jira, buffer 10% mỗi Sprint", "PM"),
    ("R-02", "Ốm đau hoặc trùng lịch thi các môn khác (single point of failure)", "Trung bình", "Cao",
     "Lập lịch tránh tuần thi, đẩy việc ưu tiên thấp sang Sprint sau, mọi thứ lưu trên Git/Jira", "PM"),
    ("R-03", "Yêu cầu thay đổi giữa chừng (scope creep)", "Trung bình", "Cao",
     "Mọi thay đổi qua Change Request, đánh giá tác động trước khi nhận vào Sprint", "PM"),
    ("R-04", "Thiếu góc nhìn độc lập khi tự review và tự test code của mình", "Cao", "Trung bình",
     "Checklist review, test theo AC viết trước, test tự động Postman/Selenium, nhờ bạn cùng lớp UAT", "TEST"),
    ("R-05", "Ước lượng sai do thiếu dữ liệu lịch sử", "Cao", "Trung bình",
     "Planning Poker 1 người theo thang Fibonacci, đo velocity thực tế Sprint 1 để hiệu chỉnh", "PM"),
    ("R-06", "Kỹ năng Spring Security/JWT còn yếu", "Trung bình", "Cao",
     "Làm spike 1 ngày ở Sprint 0, dùng mẫu chính thống từ tài liệu Spring", "BE"),
    ("R-07", "Lỗi tích hợp FE-BE do lệch hợp đồng API", "Trung bình", "Trung bình",
     "Viết OpenAPI trước, sinh mock, kiểm thử tích hợp mỗi Sprint", "BE"),
    ("R-08", "Mất dữ liệu hoặc mã nguồn", "Thấp", "Cao",
     "Push GitHub hằng ngày, sao lưu MySQL hằng ngày, tag mỗi Sprint", "BE"),
    ("R-09", "Giới hạn gói Jira Free (không có Advanced Roadmaps, quyền hạn đơn giản)", "Thấp", "Thấp",
     "Dùng Timeline cơ bản + Gantt Excel làm baseline chính thức", "PM"),
    ("R-10", "Lỗi bảo mật: lộ dữ liệu Intern khác, SQL Injection", "Thấp", "Cao",
     "JPA parameter binding, kiểm tra quyền sở hữu ở tầng Service, TC-RBAC/TC-SEC", "TEST"),
    ("R-11", "Dữ liệu dashboard sai do công thức tiến độ chưa rõ", "Trung bình", "Trung bình",
     "BA chốt BR-11 và ví dụ tính tay trước khi code, test TC-PRG-01", "BA"),
    ("R-12", "Môi trường demo lỗi đúng ngày nghiệm thu", "Thấp", "Cao",
     "Chạy thử demo 2 ngày trước, chuẩn bị video demo và dữ liệu dự phòng", "PM"),
]

EPIC_KEYS = {g[0]: g for g in WBS if is_group(g[0])}
