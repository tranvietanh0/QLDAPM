# Báo cáo kiểm thử: ứng dụng IMS (quản lý thực tập sinh)

- Ngày: 2026-11-05, múi giờ Asia/Bangkok
- Phạm vi: backend Spring Boot (`app/backend`), frontend Vite/React (`app/frontend`), API đang chạy trên `http://127.0.0.1:8081`
- Commit kiểm thử: `4ec5e99` (nhánh `main`); không sửa mã nguồn nào

## Kết quả tổng quan

Backend build và chạy đủ 3/3 bài kiểm thử tự động, không lỗi. Frontend build thành công, không có cảnh báo. Smoke test API chỉ đọc đạt 53/55 kiểm tra. Hai kiểm tra còn lại thất bại vì một lỗi thật trong `ApiExceptionHandler`: đường dẫn không tồn tại và method không được hỗ trợ đều trả HTTP 500 thay vì 404 và 405. Lỗi này không gây lộ dữ liệu, nhưng sai mã trạng thái và thông báo gây hiểu nhầm.

Chưa đo được độ phủ mã (line/branch coverage) vì `pom.xml` không cấu hình JaCoCo. Frontend không có bất kỳ bài kiểm thử, lint hay typecheck nào. Có nhiều luồng nghiệp vụ quan trọng không có kiểm thử tự động, trong đó có một hồi quy đã từng là BUG-001 (chuyển TODO sang COMPLETED).

Trạng thái: DONE_WITH_CONCERNS (xem mục Vấn đề và Câu hỏi còn mở).

## 1. Lệnh đã chạy

| Bước | Lệnh | Kết quả |
|---|---|---|
| Backend test | `cd app/backend && ~/.m2/wrapper/dists/apache-maven-3.9.9/3477a4f1/bin/mvn -B -Djava.version=17 test` | Exit 0, BUILD SUCCESS, 11.608 s |
| Frontend build | `cd app/frontend && npm run build` | Exit 0, built in 1.43 s |
| API smoke | `curl` chỉ GET, cộng 2 lần POST `/api/auth/login` (xem mục 4) | 53 PASS, 2 FAIL |

Lưu ý về JDK: máy chỉ có JDK 17 trong khi `pom.xml` khai báo `java.version` 21. Các bài test đã chạy trên JDK 17 với `-Djava.version=17`, nên chưa kiểm chứng build trên JDK 21 mà dự án khai báo.

## 2. Kiểm thử backend

Tổng: 3 test, 3 pass, 0 fail, 0 error, 0 skipped.

| Lớp kiểm thử | Test | Pass | Fail | Lỗi | Bỏ qua | Thời gian |
|---|---|---|---|---|---|---|
| `ApiIntegrationTest` | 2 | 2 | 0 | 0 | 0 | 1.501 s |
| `AdminInternFlowTest` | 1 | 1 | 0 | 0 | 0 | 7.630 s |

- Cả hai lớp dùng H2 in-memory ở chế độ MySQL, không chạm vào MySQL đang chạy.
- Maven chỉ in thời gian theo lớp, không in theo từng test.
- Log chỉ có một cảnh báo của JVM: `Sharing is only supported for boot loader classes`. Đây là cảnh báo của JVM, không liên quan đến code dự án, và không có `[WARNING]` nào của Maven.
- Không thấy test nào flaky trong lần chạy này. Chưa chạy lặp lại để kiểm chứng tính ổn định.

## 3. Build frontend

Build thành công trong 1.43 s với 36 module.

| File | Kích thước | Gzip |
|---|---|---|
| `dist/index.html` | 0.36 kB | 0.26 kB |
| `dist/assets/index-*.css` | 20.65 kB | 5.72 kB |
| `dist/assets/index-*.js` | 214.28 kB | 66.99 kB |

Không có cảnh báo. Lệnh build đã tạo thư mục `app/frontend/dist/`; cần kiểm tra thư mục này có được ignore trong git hay không.

## 4. Smoke test API (chỉ đọc)

Phương pháp: login bằng ba tài khoản demo, sau đó chỉ gửi GET. Không gọi `/api/auth/logout` vì endpoint này xóa một dòng trong `user_sessions`, tức là một lần ghi vào DB. Vì lý do tương tự, không chạy `app/scripts/smoke_api.py`, script này cũng gọi logout. Ba lần login thành công đã tạo ba phiên mới trong bảng `user_sessions` của DB sống. Các phiên này hết hạn sau 12 giờ.

Dữ liệu sống chỉ có một hồ sơ thực tập sinh (id 1, do `mentor@gmail.com` hướng dẫn), chưa có đánh giá nào. Vì vậy các kiểm tra "xem hồ sơ người khác" và "xem đánh giá có dữ liệu" không kiểm được trên dữ liệu thật. Phần này được bù bằng `AdminInternFlowTest` ở H2.

Trong các endpoint GET của controller, không có endpoint nào giới hạn quyền ADMIN ở mức GET. Giới hạn theo vai trò duy nhất ở GET là `/api/tasks/my-tasks` (chỉ INTERN). Vì vậy kiểm tra "intern gọi GET admin-only" được thay bằng kiểm tra `my-tasks` với ADMIN và MENTOR.

Kiểm tra ghi (POST, PUT, DELETE) để xác minh 403 không được thực hiện trên DB sống, theo ràng buộc của người dùng. Phần này được `ApiIntegrationTest` và `AdminInternFlowTest` kiểm tra ở H2.

### Bảng kết quả (55 kiểm tra: 53 PASS, 2 FAIL)

| ID | Endpoint | Vai trò | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|---|
| H01 | `GET /api/health` | Công khai | 200 | 200 | PASS |
| H02 | `GET /` | Công khai | 200 | 200 | PASS |
| A01 | `GET /api/auth/me` | Không token | 401 | 401 | PASS |
| A02 | `GET /api/dashboard/statistics` | Không token | 401 | 401 | PASS |
| A03 | `GET /api/mentors` | Không token | 401 | 401 | PASS |
| A04 | `GET /api/departments` | Không token | 401 | 401 | PASS |
| A05 | `GET /api/interns` | Không token | 401 | 401 | PASS |
| A06 | `GET /api/interns/1` | Không token | 401 | 401 | PASS |
| A07 | `GET /api/tasks` | Không token | 401 | 401 | PASS |
| A08 | `GET /api/tasks/my-tasks` | Không token | 401 | 401 | PASS |
| A09 | `GET /api/reports` | Không token | 401 | 401 | PASS |
| A10 | `GET /api/evaluations` | Không token | 401 | 401 | PASS |
| A11 | `GET /api/evaluations/1` | Không token | 401 | 401 | PASS |
| T01 | `GET /api/interns` | Token không hợp lệ | 401 | 401 | PASS |
| T02 | `GET /api/interns` | Header không có `Bearer` | 401 | 401 | PASS |
| E01 | `GET /api/does-not-exist` | ADMIN | 404 | **500** | **FAIL** |
| E02 | `GET /api/interns/abc` | ADMIN | 400 | 400 | PASS |
| E03 | `GET /api/interns/999999` | ADMIN | 404 | 404 | PASS |
| E04 | `GET /api/admin/departments` | ADMIN | 405 | **500** | **FAIL** |
| R01 | `GET /api/auth/me` | ADMIN / MENTOR / INTERN | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R02 | `GET /api/dashboard/statistics` | ADMIN / MENTOR / INTERN | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R03 | `GET /api/mentors` | ADMIN / MENTOR / INTERN | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R04 | `GET /api/departments` | ADMIN / MENTOR / INTERN | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R05 | `GET /api/interns` | ADMIN / MENTOR / INTERN | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R06 | `GET /api/tasks` | ADMIN / MENTOR / INTERN | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R07 | `GET /api/reports` | ADMIN / MENTOR / INTERN | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R08 | `GET /api/evaluations` | ADMIN / MENTOR / INTERN | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R09 | `GET /api/tasks/my-tasks` | ADMIN / MENTOR / INTERN | 403 / 403 / 200 | 403 / 403 / 200 | PASS |
| R10 | `GET /api/interns/1` | ADMIN / MENTOR / INTERN (của chính mình) | 200 / 200 / 200 | 200 / 200 / 200 | PASS |
| R11 | `GET /api/interns/999999` | INTERN | 404 | 404 | PASS |
| R12 | `GET /api/evaluations/1` | ADMIN / MENTOR / INTERN | 200 hoặc 404 | 404 / 404 / 404 | PASS |
| L01 | `POST /api/auth/login` sai mật khẩu | Không token | 401 | 401 | PASS |
| L02 | `POST /api/auth/admin/login` với tài khoản intern | INTERN | 403 | 403 | PASS |

Ghi chú về R12: `GET /api/evaluations/{id}` trả 404 vì chưa có đánh giá nào cho hồ sơ 1 trong DB sống. Nhánh 200 không được kiểm chứng trên dữ liệu thật.

Ghi chú về E01 và E04: các endpoint trả về `{"error":"Lỗi máy chủ, hãy kiểm tra nhật ký server"}`, không có stack trace.

### Nguyên nhân hai lỗi FAIL (E01, E04)

Lớp `ApiExceptionHandler` (`app/backend/src/main/java/com/example/internms/controller/ApiExceptionHandler.java`) có một handler bắt mọi `Exception` và trả HTTP 500. Spring ném ngoại lệ 404 (`NoResourceFoundException`) và 405 (`HttpRequestMethodNotSupportedException`) như ngoại lệ thông thường, nên handler này bắt luôn. Kết quả là các lỗi phía client bị biến thành 500. Đây là kết luận từ đọc mã và quan sát trực tiếp; chưa có test tự động nào tái hiện được. Dự án dùng Spring Boot 3.3.4 (theo `pom.xml`).

## 5. Đối chiếu với TC01–TC18 trong `app/docs/05-testing.md`

| TC | Kịch bản | Trạng thái kiểm thử |
|---|---|---|
| TC01 | Login đúng | Có (H2 và live) |
| TC02 | Login sai mật khẩu, 401 | Live (L01). Không có trong bộ test tự động |
| TC03 | Admin tạo intern hợp lệ | Có (`AdminInternFlowTest`) |
| TC04 | Tạo intern trùng email | Không có |
| TC05 | Ngày kết thúc không sau ngày bắt đầu | Không có |
| TC06 | Mentor tạo task cho intern của mình | Có (`ApiIntegrationTest`) |
| TC07 | Mentor tạo task cho intern khác, 403 | Có (`AdminInternFlowTest`) |
| TC08 | Deadline ngoài kỳ thực tập, 400 | Không có |
| TC09 | Intern TODO sang IN_PROGRESS | Có (cả hai lớp) |
| TC10 | Intern TODO sang COMPLETED, 400 | **Không có. Đây là hồi quy của BUG-001** |
| TC11 | Intern sửa task của người khác, 403 | Một phần: chỉ kiểm tra endpoint status |
| TC12 | Intern nộp báo cáo tuần, trạng thái SUBMITTED | Một phần: chỉ kiểm tra HTTP 200, không kiểm tra trạng thái |
| TC13 | Nộp trùng tuần, bị từ chối | Không có |
| TC14 | Mentor review báo cáo, REVIEWED | Có (`AdminInternFlowTest`) |
| TC15 | Điểm ngoài 0..10, bị từ chối | Không có |
| TC16 | Đánh giá cuối kỳ, overall là trung bình | Một phần: tạo được nhưng không assert giá trị overall |
| TC17 | Intern xem đánh giá của mình | Một phần: chỉ có endpoint danh sách, không có `/{internId}` |
| TC18 | Intern xem đánh giá người khác, 403 | Không có |

## 6. Khoảng trống kiểm thử

Đánh giá bằng cách đối chiếu controller với các test. Không có số liệu độ phủ.

| Khu vực | Không có test tự động | Rủi ro |
|---|---|---|
| `InternController` | `PUT /{id}` (đổi mentor kéo theo cập nhật task và đánh giá), `DELETE /{id}` (xóa dây chuyền), validate ngày, email trùng (409), mật khẩu ngắn, trạng thái không hợp lệ, mentor đọc danh sách và hồ sơ | Cao |
| `TaskController` | `DELETE /{id}`, TC10 (hồi quy BUG-001), TC08, validate tiêu đề và mức ưu tiên, `PUT /{id}` đổi intern | Cao |
| `ReportController` | `PUT /{id}` (sửa báo cáo), `DELETE /{id}`, TC13 (trùng tuần), TC15 (điểm), giới hạn 3000 ký tự, sửa báo cáo đã REVIEWED (409) | Cao |
| `AdminController` | `PUT` và `DELETE` cho departments và mentors, các nhánh 409 khi xóa đang được tham chiếu, mật khẩu mentor | Trung bình |
| `AuthController` | `POST /logout`, `PUT /password` (vô hiệu hóa phiên cũ), `GET /me` | Trung bình |
| `EvaluationController` | `GET /{internId}` (TC18), kiểm tra công thức overall, kiểm tra mentor không sở hữu intern | Trung bình |
| `MetaController` | `GET /api/mentors`, `GET /api/departments` (không có test nào) | Thấp |
| `DashboardController` | Nhánh MENTOR của thống kê | Thấp |
| `HealthController` | Nhánh 503 khi DB không kết nối được | Thấp |
| `AuthService` | Hết hạn phiên (12 giờ), vô hiệu phiên khi đổi mật khẩu hoặc logout | Trung bình |
| `ApiExceptionHandler` | Phần lớn các nhánh (400 JSON lỗi, 404 `NoSuchElement`, 409 vi phạm ràng buộc, 500 catch-all, và lỗi E01/E04 đã nêu) | Cao |
| Môi trường DB | Mọi test dùng H2 chế độ MySQL. Không có test nào chạy trên MySQL thật, nên lệch dialect hoặc lỗi migration có thể lọt qua | Trung bình |
| Frontend | Không có test, lint hay typecheck. Chỉ có build | Cao |
| Desktop/Electron | `scripts/smoke-desktop.mjs` và các script desktop không được chạy trong báo cáo này | Chưa đánh giá |

## 7. Vấn đề cần xử lý ngay

1. Handler catch-all trong `ApiExceptionHandler` biến 404 và 405 thành 500 (E01, E04). Cần thêm handler riêng cho `NoResourceFoundException` và `HttpRequestMethodNotSupportedException`, hoặc giới hạn handler catch-all. Sau khi sửa, cần thêm test ở H2 để khóa hành vi này.
2. Thiếu hồi quy cho BUG-001 (TC10). Chưa có test nào xác nhận việc chuyển TODO sang COMPLETED bị từ chối với 400.
3. Build chưa được kiểm chứng trên JDK 21 mà `pom.xml` khai báo. Cần cài JDK 21 và chạy lại `mvn test` không kèm `-Djava.version=17`.

## 8. Khuyến nghị

Ưu tiên cao:
1. Sửa `ApiExceptionHandler` như mục 7, rồi thêm kiểm tra 404 và 405 vào `ApiIntegrationTest`.
2. Thêm test cho TC10, TC08, TC13, TC15 và TC18. Đây là các quy tắc nghiệp vụ đã có trong tài liệu nhưng chưa có test.
3. Thêm test cho `InternController.update` với đổi mentor, vì luồng này cập nhật task và đánh giá hàng loạt. Thêm test cho `InternController.delete` để kiểm tra xóa dây chuyền.
4. Cấu hình JaCoCo trong `pom.xml` (có thể là một thay đổi nhỏ, cần sự đồng ý trước khi sửa) để có số liệu độ phủ thật, và đặt ngưỡng 80% như trong quy trình của QA.

Ưu tiên trung bình:
5. Thêm test cho `AdminController` (sửa, xóa, nhánh 409) và `AuthController` (logout, đổi mật khẩu, vô hiệu phiên).
6. Thêm một bộ kiểm thử chạy trên MySQL thật, hoặc Testcontainers, để tránh lệch H2 và kiểm chứng migration.
7. Thêm `npm test` và `npm run lint` cho frontend, ít nhất là smoke test cho luồng đăng nhập theo từng vai trò.

Ưu tiên thấp:
8. Chạy `app/scripts/smoke_api.py` trên môi trường thử nghiệm riêng, không phải DB sống, vì nó có bước logout.
9. Chạy build và test trên JDK 21 để khớp với khai báo trong `pom.xml`.

## 9. Câu hỏi còn mở

1. Có nên sửa `ApiExceptionHandler` trong lượt này không? Báo cáo này không sửa mã nguồn theo yêu cầu.
2. Có được phép thêm plugin JaCoCo vào `pom.xml` để đo độ phủ không? Đây là thay đổi cấu hình build.
3. Có cần chạy kiểm tra ghi (403 cho POST và PUT) trên một DB thử nghiệm riêng để kiểm chứng ngoài H2 không?
4. Thư mục `app/frontend/dist/` do build tạo ra có nằm trong `.gitignore` không? Chưa kiểm tra.
5. Ba phiên đăng nhập tạo ra trong lần smoke test sẽ hết hạn sau 12 giờ. Có cần xóa sớm hơn không? Việc xóa cần thao tác ghi vào DB, nên chưa thực hiện.

Status: DONE_WITH_CONCERNS
Summary: Backend test (3/3), frontend build và 53 trên 55 kiểm tra API chỉ đọc đều đạt, trong đó hai lỗi FAIL là lỗi thật của `ApiExceptionHandler` trả 500 thay cho 404 và 405. Chưa có độ phủ mã và frontend chưa có test nào.
Concerns/Blockers: Hồi quy BUG-001 (TC10) chưa có test; build chưa được kiểm chứng trên JDK 21 mà pom khai báo; khoảng trống kiểm thử lớn ở Intern, Task, Report và frontend.
