# Báo cáo: Cho Mentor đăng nhập qua ứng dụng Admin / Server

Ngày: 2026-11-05. Xử lý phát hiện H2 trong `plans/reports/code-reviewer-261105-1002-ims-full-review.md`, theo hướng (a) mà người dùng đã chọn: không tạo portal riêng cho mentor. Portal Admin nhận cả ADMIN và MENTOR, còn việc mentor được xem dữ liệu nào vẫn do phần lọc theo vai trò sẵn có ở backend quyết định.

## Kết quả

Mentor (`mentor@gmail.com`) đã đăng nhập được vào ứng dụng Admin / Server, và dùng được ba luồng US03 (giao việc), US05 (chấm báo cáo tuần), US06 (đánh giá cuối kỳ). Intern vẫn bị chặn ở portal Admin. Portal Client không đổi, vẫn chỉ cho INTERN.

## Hành vi trước và sau

| Trường hợp | Trước | Sau |
|---|---|---|
| ADMIN gọi `POST /api/auth/admin/login` | 200 | 200 |
| MENTOR gọi `POST /api/auth/admin/login` | 403 "Ứng dụng Server chỉ dành cho quản trị viên" | 200, `role=MENTOR` |
| INTERN gọi `POST /api/auth/admin/login` | 403 | 403 "Ứng dụng Server chỉ dành cho quản trị viên và mentor" |
| INTERN gọi `POST /api/auth/intern/login` | 200 | 200 |
| ADMIN hoặc MENTOR gọi `/api/auth/intern/login` | 403 | 403 (không đổi) |
| Mentor ở UI Admin | Không vào được: frontend so `role !== 'ADMIN'` rồi từ chối | Vào được; menu "Quản trị hệ thống" bị ẩn và route `/administration` chuyển về dashboard |

Lưu ý: endpoint thật nằm ở `/api/auth/admin/login` và `/api/auth/intern/login`, không phải `/api/admin/login` như trong đề bài.

## Các file đã thay đổi

- `app/backend/src/main/java/com/example/internms/service/AuthService.java`: `login(email, password, Role portalRole)` đổi thành `login(email, password, Set<Role> portalRoles)`. Giá trị `null` nghĩa là nhận mọi vai trò, dùng cho `/api/auth/login`. Thông báo 403 được viết lại cho đúng: Client "chỉ dành cho thực tập sinh", Server "chỉ dành cho quản trị viên và mentor". Phần giới hạn số lần đăng nhập sai (`rejectIfLocked`, `recordFailure`, khóa 15 phút sau 5 lần sai) giữ nguyên. Phần kiểm tra vai trò portal vẫn chạy sau khi mật khẩu đã được xác thực, như trước.
- `app/backend/src/main/java/com/example/internms/controller/AuthController.java`: thêm hai hằng `ADMIN_PORTAL = {ADMIN, MENTOR}` và `INTERN_PORTAL = {INTERN}`, dùng cho hai endpoint portal.
- `app/frontend/src/portal.js`: bỏ `portalRole` (một chuỗi). Thay bằng `portalRoles` (mảng) và hàm `allowedInPortal(role)`.
- `app/frontend/src/App.jsx`:
  - Ba chỗ kiểm tra `v.role !== portalRole` (sau khi đăng nhập, khi khôi phục phiên qua `/auth/me`, và trong `login`) giờ dùng `!allowedInPortal(v.role)`.
  - Sửa chữ trên màn hình đăng nhập Admin: "QUẢN TRỊ VIÊN · MENTOR", "Đăng nhập Admin / Mentor", câu mô tả có nhắc mentor, và hộp hướng dẫn "Tài khoản quản trị viên hoặc mentor".
- `app/backend/src/test/java/com/example/internms/MentorPortalTest.java` (mới, 3 test, dùng DB H2 riêng `mentor_portal`):
  - Portal Admin nhận ADMIN và MENTOR, trả 403 cho INTERN.
  - Portal Intern chỉ nhận INTERN.
  - Mentor đăng nhập qua portal Admin rồi đi hết luồng: chỉ thấy intern của mình; bị 403 ở `/api/admin/departments`; tạo task cho intern của mình; chấm báo cáo tuần (trạng thái thành `REVIEWED`); tạo đánh giá cuối kỳ.
  - Mọi lần đăng nhập trong test đều dùng mật khẩu đúng, nên không chạm vào cơ chế khóa đăng nhập.

## UI khi đăng nhập bằng MENTOR

Không cần thêm điều kiện ẩn hiện nào, vì App.jsx đã kiểm tra vai trò sẵn:

- **Đã ẩn với mentor:** menu và route "Quản trị hệ thống" (`role==='ADMIN'`, dùng để quản lý phòng ban và mentor); nút "Tạo tài khoản thực tập sinh"; nút sửa và xóa intern; nút xóa báo cáo.
- **Hiển thị cho mentor:** "Giao công việc" cùng nút sửa và xóa task (`canManage`); "Chấm điểm" báo cáo; "Tạo đánh giá" và "Cập nhật đánh giá".
- **Dữ liệu dùng chung:** mọi `useResource` mà mentor gọi (`/interns`, `/tasks`, `/reports`, `/evaluations`, `/dashboard/statistics`, `/mentors`, `/departments`) chỉ yêu cầu đã đăng nhập. Backend tự lọc theo mentor: `InternController:19`, `TaskController:18`, `ReportController` list, `EvaluationController:15`, `DashboardController:24`.

Phần Electron (`app/desktop/main.cjs`, `backend.cjs`, `preload.cjs`) chỉ phân biệt chế độ `admin` và `intern`, không gắn cứng vai trò ADMIN, nên không phải sửa.

## Kiểm chứng

`mvn -B -Djava.version=17 test` (chạy trong `app/backend`):

```
Tests run: 1  ... AdminInternFlowTest
Tests run: 2  ... ApiIntegrationTest
Tests run: 8  ... BusinessRuleTest
Tests run: 5  ... ErrorHandlingAndLoginLimitTest
Tests run: 3  ... MentorPortalTest
Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

`npm run build` (chạy trong `app/frontend`): `✓ 36 modules transformed`, `✓ built in 829ms`.

Không khởi động hay gọi server đang chạy ở :8081, và chưa commit.

## Việc còn lại (ngoài phạm vi, không sửa)

- Tài liệu chưa được cập nhật: bảng phân quyền và mô tả endpoint portal trong `app/docs/04`, README (mô hình "Admin/Server"), và `docs/02` vẫn chưa ghi rằng portal Admin nhận cả mentor. Lần này không được phép sửa docs.
- Dashboard ở portal Client vẫn ghi "Được quản trị viên phân công", trong khi thực tế task do mentor giao. Đây là chữ hiển thị cho intern nên chưa đổi.
- `scripts/smoke-desktop.mjs` chưa có bước đăng nhập bằng mentor ở UI.
