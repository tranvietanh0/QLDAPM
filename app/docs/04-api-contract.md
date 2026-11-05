# REST API Contract – QLDAPM

Base URL mặc định: `http://localhost:8081/api`; phía Client Vite dùng đường dẫn tương đối `/api`. Mọi API nghiệp vụ (trừ `/health` và các endpoint đăng nhập) yêu cầu `Authorization: Bearer <token>`.

| Method | Endpoint | Quyền | Ý nghĩa |
|---|---|---|---|
| GET | `/health` | Public | Trạng thái server |
| POST | `/auth/login` | Public | Đăng nhập, trả token (mọi vai trò) |
| POST | `/auth/admin/login` | Public | Đăng nhập ứng dụng Admin / Server; chỉ ADMIN, MENTOR (INTERN nhận 403) |
| POST | `/auth/intern/login` | Public | Đăng nhập Client thực tập sinh; chỉ INTERN (vai trò khác nhận 403) |
| POST | `/auth/logout` | Đã đăng nhập | Xóa phiên đăng nhập |
| GET | `/auth/me` | Đã đăng nhập | Tài khoản hiện tại |
| PUT | `/auth/password` | Đã đăng nhập | Đổi mật khẩu, vô hiệu phiên cũ |
| GET | `/dashboard/statistics` | Đã đăng nhập | Dashboard |
| GET | `/mentors` | Đã đăng nhập | Danh sách Mentor |
| GET | `/departments` | Đã đăng nhập | Danh sách phòng ban |
| POST, PUT, DELETE | `/admin/mentors` hoặc `/admin/mentors/{id}` | ADMIN | Quản lý Mentor |
| POST, PUT, DELETE | `/admin/departments` hoặc `/admin/departments/{id}` | ADMIN | Quản lý phòng ban |
| GET | `/interns`, `/interns/{id}` | Phân quyền | Xem thực tập sinh |
| POST, PUT, DELETE | `/interns`, `/interns/{id}` | ADMIN | Quản lý thực tập sinh |
| GET | `/tasks`, `/tasks/my-tasks` | Phân quyền | Danh sách công việc |
| POST, PUT | `/tasks`, `/tasks/{id}` | MENTOR | Giao/sửa công việc được quản lý |
| DELETE | `/tasks/{id}` | ADMIN / MENTOR | Xóa công việc |
| PUT | `/tasks/{id}/status` | INTERN | TODO → IN_PROGRESS → COMPLETED |
| GET | `/reports` | Phân quyền | Báo cáo tuần |
| POST, PUT | `/reports`, `/reports/{id}` | INTERN | Nộp/sửa báo cáo trước khi chấm |
| DELETE | `/reports/{id}` | ADMIN hoặc INTERN chưa được chấm | Xóa báo cáo |
| PUT | `/reports/{id}/review` | MENTOR | Nhận xét và cho điểm |
| GET | `/evaluations`, `/evaluations/{internId}` | Phân quyền | Đọc đánh giá cuối kỳ |
| POST | `/evaluations` | MENTOR | Tạo/cập nhật đánh giá |

**Ví dụ login:**

```http
POST /api/auth/admin/login
Content-Type: application/json

{"email":"admin@gmail.com","password":"123456"}
```

**Ví dụ tạo Intern (ADMIN):**

```json
{"name":"Nguyễn Văn A","email":"student01@example.com","password":"12345678", "departmentId":1,"mentorId":2,"startDate":"2026-09-01","endDate":"2027-06-30","status":"ACTIVE"}
```

**Ví dụ tạo công việc (MENTOR):**

```json
{"internId":1,"title":"Thiết kế giao diện","description":"Tạo UI","priority":"HIGH","deadline":"2026-12-10"}
```

**Ví dụ nhận xét báo cáo (MENTOR):**

```json
{"mentorComment":"Hoàn thành tốt","rating":9}
```

- Mã lỗi (body JSON `{"error": "..."}`): 400 dữ liệu không hợp lệ; 401 sai thông tin đăng nhập hoặc thiếu/hết phiên; 403 thiếu quyền hoặc đăng nhập sai ứng dụng; 404 không có bản ghi hoặc đường dẫn không tồn tại; 405 sai HTTP method (kèm header `Allow`); 409 dữ liệu trùng/đang tham chiếu; 415 `Content-Type` không được hỗ trợ (hãy gửi JSON); 429 đăng nhập sai quá nhiều lần; 500 lỗi server không lường trước (được ghi vào log server).
- Giới hạn đăng nhập: sai 5 lần cho cùng một email trong 15 phút thì các lần đăng nhập tiếp theo trả 429 cho tới khi hết 15 phút tính từ lần sai đầu tiên; đăng nhập đúng sẽ xóa bộ đếm. Bộ đếm lưu trong bộ nhớ, mất khi khởi động lại server.
- Phiên đăng nhập dùng token ngẫu nhiên, lưu SHA-256 token trong bảng `user_sessions`; thời hạn mặc định 12 giờ.
