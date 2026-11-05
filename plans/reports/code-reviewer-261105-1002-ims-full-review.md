# Review toàn bộ codebase IMS (Intern Management) — 2026-11-05

## Phạm vi

- Backend: `app/backend` (Spring Boot 3.3.4) — 31 file Java chính, 2 file test, `pom.xml`, 2 file `.properties`.
- Frontend: `app/frontend/src` (`App.jsx`, `api.js`, `portal.js`, `main.jsx`), `vite.config.js`.
- Desktop/scripts: `app/desktop/*.cjs`, `app/scripts/*.mjs`, `app/package.json`, `app/*.bat`.
- Tài liệu đối chiếu: `app/docs/02-ba-requirements.md`, `app/docs/04-api-contract.md`, `05-testing.md`, `07-server-client-guide.md`, `README.md`.
- Khoảng 2.400 dòng (riêng `App.jsx` 207 dòng nhưng nặng 49,7 KB).
- Không đọc các file `.env*` (bị hook privacy chặn).
- Không nhắc lại: App.jsx:96 chỉ chấp nhận MySQL/MariaDB (cố ý); code được import nguyên trạng ở commit 4ec5e99.

## Đánh giá tổng quan

Phần phân quyền phía server làm khá chắc: mọi endpoint nghiệp vụ đều gọi `requireUser`/`requireRole`, và các kiểm tra chủ sở hữu (IDOR) nhất quán. **Không tìm thấy lỗ hổng IDOR nào**: intern không đọc hay sửa được task, báo cáo, đánh giá hoặc hồ sơ của intern khác. Các vấn đề lớn nằm ở chỗ khác: (1) tài khoản mặc định với mật khẩu yếu lại được hiển thị ngay trên UI; (2) **vai trò Mentor có trong yêu cầu nhưng không có giao diện nào để dùng**; (3) handler lỗi chung nuốt mọi exception mà không ghi log; (4) thiếu CI, test còn mỏng, phiên bản Java không khớp.

### Đã kiểm tra IDOR (đều đạt)

| Thao tác | Kiểm tra quyền sở hữu | Vị trí |
|---|---|---|
| Intern đổi trạng thái task | `t.getIntern().getId().equals(i.getId())` | TaskController.java:41 |
| Intern xem danh sách task | lọc theo profile của chính mình | TaskController.java:19,21 |
| Mentor sửa/xóa task | `t.getMentor()` = mình, và intern đích thuộc mình | TaskController.java:30-31,36 |
| Intern sửa/xóa báo cáo | `w.getIntern().getUser()` = mình, chưa REVIEWED | ReportController.java:28-29,35-36 |
| Mentor chấm báo cáo | `w.getIntern().getMentor()` = mình | ReportController.java:41 |
| Xem đánh giá / hồ sơ theo id | INTERN chỉ của mình, MENTOR chỉ intern được giao | EvaluationController.java:26-27, InternController.java:25-26 |
| Mọi endpoint `/api/admin/**`, CRUD `/api/interns` | `requireRole(ADMIN)` | AdminController.java:18-23, InternController.java:35,44,63 |

---

## Critical

Không có.

## High

### H1. Tài khoản mặc định `123456` được seed và hiển thị công khai trên màn hình đăng nhập Admin
- **Vị trí:** `backend/.../config/DataSeeder.java:18-20`; `frontend/src/App.jsx:87` (điền sẵn `admin@gmail.com`), `App.jsx:114` (hộp "Admin mặc định… Mật khẩu: 123456"); `application.properties:3` (`server.address=0.0.0.0`).
- **Kịch bản lỗi:** Mỗi khi tạo DB mới, hệ thống seed 3 tài khoản ADMIN/MENTOR/INTERN với mật khẩu `123456`. Mật khẩu này vi phạm chính chính sách tối thiểu 8 ký tự của hệ thống (AdminController.java:21, InternController.java:37, AuthService.java:57). API lắng nghe trên mọi interface, nên bất kỳ máy nào trong LAN cũng gọi được `POST http://<ip>:8081/api/auth/login {"email":"admin@gmail.com","password":"123456"}` và nhận ngay token ADMIN, sau đó xóa toàn bộ intern. Chính UI Admin lại in sẵn mật khẩu này ra màn hình. Không có cơ chế buộc đổi mật khẩu.
- **Cách sửa:** Chỉ seed khi profile `demo` bật (`@Profile("demo")` trên `DataSeeder`). Với MySQL, lấy mật khẩu admin ban đầu từ biến môi trường (`ADMIN_INITIAL_PASSWORD`, báo lỗi khi khởi động nếu thiếu). Thêm cờ `mustChangePassword` trên `User` và chặn mọi API, trừ `/auth/password`, cho đến khi đổi. Gỡ hộp demo và giá trị điền sẵn ở App.jsx:87,114.

### H2. Vai trò Mentor không có giao diện, nên các yêu cầu US03/US05/US06 không dùng được qua ứng dụng
- **Vị trí:** `frontend/src/portal.js:1-3` (chỉ có 2 portal `admin`/`intern`); `App.jsx:109` (chỉ gọi `/auth/admin/login` hoặc `/auth/intern/login`); `App.jsx:110,201` (từ chối mọi role khác `portalRole`); `AuthService.java:40` (portal ADMIN/INTERN trả 403 với MENTOR).
- **Kịch bản lỗi:** `docs/02` mô tả actor Mentor: xem intern được giao, giao task (US03), review báo cáo (US05), đánh giá cuối kỳ (US06). README:73-86 cũng ghi Mentor "Có" quyền đăng nhập và chấm báo cáo. Thực tế, `mentor@gmail.com` đăng nhập ở Client thì nhận 403 "Ứng dụng Client chỉ dành cho thực tập sinh", còn ở Server thì nhận 403 "chỉ dành cho quản trị viên". Mentor chỉ dùng được qua Postman với `/api/auth/login`. Toàn bộ code nhánh MENTOR trong `App.jsx` (`canManage`, `role==='MENTOR'`) là code chết. Thêm nữa, test UI `smoke-desktop.mjs` cho ADMIN chấm báo cáo, nên không test nào bao phủ luồng Mentor.
- **Cách sửa:** Chọn một trong hai hướng và ghi rõ trong docs: (a) cho portal Admin chấp nhận MENTOR (`portalRole` thành mảng `['ADMIN','MENTOR']`, thêm `/auth/staff/login` cho phép `Role.ADMIN, Role.MENTOR`, ẩn menu "Quản trị hệ thống" với MENTOR như App.jsx:120 đã làm); hoặc (b) thêm portal thứ ba `mentor`. Nếu nhóm quyết định bỏ Mentor khỏi UI, phải cập nhật lại `docs/02` và bảng phân quyền trong README.

### H3. `ApiExceptionHandler` nuốt mọi exception không ghi log và biến 404/405/415 thành 500
- **Vị trí:** `controller/ApiExceptionHandler.java:25-26` (cũng như `:16`, `:18`, `:24`: không handler nào ghi log).
- **Kịch bản lỗi:** (1) Khi có `NullPointerException` hay lỗi SQL trong production, người dùng thấy "Lỗi máy chủ, hãy kiểm tra nhật ký server", nhưng nhật ký không có stack trace vì exception đã bị `@ExceptionHandler(Exception.class)` bắt và bỏ qua. `server.log` mà `desktop/backend.cjs` ghi ra cũng trống, nên không thể debug. (2) `GET /api/tasks/1/status` (sai method) ném `HttpRequestMethodNotSupportedException`; URL không tồn tại `/api/abc` ném `NoResourceFoundException` (Spring 6.1+); sai Content-Type ném `HttpMediaTypeNotSupportedException`. Cả ba đều bị handler chung bắt và trả 500, trái với hợp đồng mã lỗi ở `docs/04:57`. (3) `DataIntegrityViolationException` (`:17-18`) luôn trả "đang được sử dụng hoặc bị trùng", kể cả khi nguyên nhân là chuỗi quá dài (xem L9).
- **Cách sửa:** Cho class kế thừa `ResponseEntityExceptionHandler` để Spring tự xử lý 404/405/415, hoặc thêm handler cho `ErrorResponse` và trả `e.getStatusCode()`. Trong handler `Exception`, thêm `log.error("Unhandled", e)`. Trong handler 409 thì `log.warn`.

## Medium

### M1. Không giới hạn số lần đăng nhập sai (brute-force, DoS CPU qua BCrypt)
- **Vị trí:** `service/AuthService.java:36-43`; `AuthController.java:12-14`.
- **Kịch bản lỗi:** Kẻ tấn công trong LAN thử mật khẩu không giới hạn trên cả 3 endpoint login. Kết hợp H1 thì chỉ cần 1 request. Ngoài ra, mỗi lần login sai tốn một phép BCrypt (cost 10, khoảng 50-100 ms), nên vài chục request song song có thể làm nghẽn CPU server.
- **Cách sửa:** Bộ đếm lỗi theo email và theo IP (ví dụ `ConcurrentHashMap` kèm khóa 15 phút sau 5 lần sai, hoặc Bucket4j). Trả 429 khi vượt ngưỡng. README:119 đã tự nhận thiếu điểm này.

### M2. Truyền token/mật khẩu qua HTTP thuần trong LAN; mặc định DB `root` mật khẩu rỗng
- **Vị trí:** `application.properties:3-6` (`0.0.0.0`, `DB_USER:root`, `DB_PASSWORD:` rỗng, `useSSL=false&allowPublicKeyRetrieval=true`); `desktop/main.cjs:8`; `docker-compose.yml:6` (`root`/`root`, mở cổng 3306).
- **Kịch bản lỗi:** Client và Server ở hai máy (docs/07) trao đổi Bearer token và mật khẩu ở dạng rõ. Bất kỳ ai sniff được mạng Wi-Fi lớp học đều chiếm được phiên ADMIN. Ứng dụng chạy bằng tài khoản MySQL `root`, nên nếu có lỗi SQL thì toàn bộ server MySQL bị ảnh hưởng.
- **Cách sửa:** Tạo user MySQL riêng chỉ có quyền trên `intern_management`. Bind `server.address=${SERVER_ADDRESS:127.0.0.1}` và chỉ mở `0.0.0.0` khi cần demo LAN. Nếu demo qua LAN, bật `server.ssl.*` với keystore tự ký, hoặc ít nhất ghi rõ rủi ro trong README.

### M3. Trường số kiểu primitive: thiếu `rating`/điểm thành phần thì lặng lẽ thành 0
- **Vị trí:** `ReportController.java:14` (`double rating`); `EvaluationController.java:13` (4 trường `double`), `:22` (tính `overallScore`).
- **Kịch bản lỗi:** `PUT /api/reports/5/review {"mentorComment":"OK"}` bị Jackson gán `rating=0.0`, qua được kiểm tra 0..10, và báo cáo chuyển REVIEWED với điểm 0. Tương tự, `POST /api/evaluations {"internId":1,"technicalSkill":9}` cho 3 tiêu chí còn lại bằng 0 và overall 2,25. Dữ liệu sai mà không có cảnh báo nào, trái với US05/US06.
- **Cách sửa:** Đổi sang `Double`/`Integer` và kiểm tra `null`, trả 400 "Thiếu điểm". Hoặc dùng `@NotNull @DecimalMin("0") @DecimalMax("10")` kèm `@Valid`, vì dependency `spring-boot-starter-validation` đã có sẵn nhưng chưa dùng.

### M4. Phiên bản Java không khớp: `pom.xml` yêu cầu 21, máy và bản build thực tế là 17
- **Vị trí:** `backend/pom.xml:14` (`<java.version>21</java.version>`); `KIEM_TRA_MOI_TRUONG.bat:3`, `README.md:28,108`, `docs/07:3`, `START_SERVER_DEMO.bat:14` (đều ghi JDK 21).
- **Bằng chứng:** `java -version` trên máy là Temurin 17.0.20. File `.class` đã build có major version 61 (Java 17), và surefire report ghi `java.version=17`. Nghĩa là bản build hiện có được tạo bằng cách override thủ công.
- **Kịch bản lỗi:** Trên máy chỉ có JDK 17, `START_SERVER_MYSQL.bat` gọi `mvn spring-boot:run` và thất bại với `release version 21 not supported`. Desktop Admin báo chung chung "Server không khởi động được".
- **Cách sửa:** Code không dùng tính năng riêng của Java 21 (đã grep: chỉ có record, switch expression, `HexFormat` của Java 17), nên đặt `<java.version>17</java.version>` và sửa các tài liệu cho khớp. Hoặc giữ 21 nhưng thêm `maven-enforcer-plugin` (`requireJavaVersion`) để báo lỗi rõ ràng. Chọn một bản duy nhất.

### M5. Test mỏng, không có CI; chưa có test tự động cho phần lớn test case trong docs/05
- **Vị trí:** `backend/src/test/.../ApiIntegrationTest.java` (2 test), `AdminInternFlowTest.java` (1 test luồng dài); frontend không có test hay lint; repo không có `.github/workflows`.
- **Chi tiết:** Các test hiện có chỉ phủ luồng đúng cùng một số trường hợp 403 (TC07, TC11, xem hồ sơ người khác). **Chưa có test tự động** cho TC02 (sai mật khẩu, 401), TC04 (trùng email), TC05 (ngày kết thúc ≤ ngày bắt đầu), TC08 (deadline ngoài kỳ), TC10 (TODO→COMPLETED, 400), TC13 (trùng tuần), TC15 (rating ngoài 0..10), TC16 (kiểm tra overall = trung bình), TC18 (intern xem đánh giá người khác). Test chạy trên H2 `MODE=MySQL`, không phải MySQL thật. `scripts/smoke-desktop.mjs:8-9` phụ thuộc mật khẩu `123456` của H1.
- **Kịch bản lỗi:** Ai đó sửa điều kiện ở `TaskController.java:43` thành cho phép TODO→COMPLETED, đúng bug mẫu BUG-001 trong docs/05, mà CI không bắt được vì không có CI và không có test.
- **Cách sửa:** Thêm một `@ParameterizedTest`/MockMvc cho từng TC trên. Thêm workflow GitHub Actions: `setup-java@v4` (17), `mvn -B test`, `npm ci && npm run build` trong `frontend`. Môn QLDAPM nên có thêm badge hoặc báo cáo kết quả test.

### M6. Schema DB do `ddl-auto=update` quản lý, không có migration
- **Vị trí:** `application.properties:8`; `application-demo.properties:6`; `database/schema_full_mysql.sql` duy trì tay song song.
- **Kịch bản lỗi:** Đổi tên hoặc kiểu cột trong entity thì Hibernate `update` không xóa hay đổi cột cũ. Ví dụ đổi `priority` sang enum, hoặc rút `length=3000` xuống, thì DB thật giữ cấu trúc cũ và lệch với `schema_full_mysql.sql`. Không có cách rollback.
- **Cách sửa:** Thêm Flyway (`spring-boot-starter-flyway` + `db/migration/V1__init.sql` lấy từ `schema_full_mysql.sql`), đặt `ddl-auto=validate`. README:119 đã nhắc nhưng chưa làm.

### M7. Bản exe Client không trỏ được tới Server ở máy khác; bản exe Server không chạy độc lập
- **Vị trí:** `desktop/main.cjs:8` (backend = `API_SERVER` env hoặc `127.0.0.1:8081`); `desktop/backend.cjs:28-33,36` (Server exe cần thư mục cha chứa `START_SERVER_MYSQL.bat`, Maven và JDK).
- **Kịch bản lỗi:** README:13-21 vẽ mô hình "Admin/Server (.exe) ↔ Intern/Client (.exe)". Khi copy `QLDAPM-Client.exe` sang máy intern rồi double-click, exe luôn proxy tới `127.0.0.1:8081` của chính máy đó, nên đăng nhập báo "Không kết nối được server". Không có UI hay file cấu hình để nhập IP server; người dùng phổ thông không đặt được biến môi trường `API_SERVER`. Còn `QLDAPM-Server.exe` copy sang máy khác thì báo "Không tìm thấy dự án để chạy Server", vì exe chỉ là launcher gọi `mvn spring-boot:run` trên source.
- **Cách sửa:** Client: đọc `server-url` từ file `config.json` cạnh exe hoặc trong `userData`, kèm màn hình "Cấu hình Server" ở Login. Server: đóng gói `intern-management.jar` (dùng `spring-boot-maven-plugin repackage`) vào `extraResources` và chạy `java -jar`, bỏ phụ thuộc Maven và source. Ghi rõ giới hạn hiện tại trong docs/07.

### M8. `App.jsx` là một file khối 49,7 KB, khó bảo trì và review
- **Vị trí:** `frontend/src/App.jsx` (toàn bộ 12 màn hình/component trong 1 file; dòng 130 dài 4.146 ký tự, dòng 172 dài 3.681, dòng 158 dài 3.308, dòng 144 dài 3.032).
- **Kịch bản lỗi:** Mọi thay đổi nhỏ đều tạo diff trên một dòng dài hàng nghìn ký tự, nên không review được trên GitHub và dễ conflict khi nhiều thành viên cùng sửa. Đây là rủi ro quản lý dự án thật với nhóm sinh viên. Không có ESLint hay Prettier để giữ format.
- **Cách sửa:** Tách theo màn hình: `src/pages/{dashboard,interns,tasks,reports,evaluations,administration,profile,login}.jsx`, `src/components/ui.jsx` (Icon, Modal, Table, FormField…), `src/hooks/{use-resource,use-action}.js`. Thêm Prettier và ESLint (`eslint-plugin-react-hooks`) kèm script `npm run lint`. Không cần đổi logic.

### M9. Hiệu năng: N+1 do quan hệ EAGER cộng `findAll`, cộng polling 10 giây
- **Vị trí:** `DashboardController.java:27-31` (ADMIN `tasks.findAll()` chỉ để đếm; MENTOR/INTERN lặp `findByInternId` theo từng profile); `ReportController.java:18` (lặp theo từng intern của mentor); các `@ManyToOne`/`@OneToOne` mặc định EAGER ở `TaskItem.java:15-16`, `InternProfile.java:10-12`, `WeeklyReport.java:9`; `App.jsx:65` (`setInterval(…,10000)` cho mỗi `useResource`), `App.jsx:126-127` (Dashboard mở 4 resource cùng lúc). `TaskRepository.countByStatus` có sẵn nhưng không được dùng.
- **Kịch bản lỗi:** Với 200 intern và 2.000 task, mỗi lần Dashboard Admin refresh phải tải toàn bộ task cùng các truy vấn phụ cho intern, user, department, mentor, cộng thêm `/interns`, `/tasks`, `/reports`. 10 client mở cùng lúc tạo khoảng 4 request nặng mỗi client mỗi 10 giây.
- **Cách sửa:** Dùng `countByStatus` hoặc `countByInternIdInAndStatus` cho dashboard. Dùng `@EntityGraph(attributePaths={"intern.user","intern.department","mentor"})` trên các `find*` và `fetch=LAZY` + DTO. Thêm `findByInternMentorId` cho báo cáo. Tăng chu kỳ polling (30-60 giây) hoặc chỉ refresh khi focus.

## Low

### L1. Lost update khi tính `progress` song song; race đổi mentor khi đang tạo task
- **Vị trí:** `TaskController.java:47` (`progress()` đọc toàn bộ task rồi ghi đè `progress`); `InternController.java:54` cùng `TaskController.java:27`; `TaskController.java:36` (delete chỉ kiểm tra `t.getMentor()`).
- **Kịch bản:** Hai request đổi trạng thái 2 task của cùng một intern chạy song song (MySQL REPEATABLE READ). Mỗi transaction thấy snapshot cũ, nên `progress` cuối có thể là 50% thay vì 100%. Trường hợp khác: Admin đổi mentor trong lúc mentor cũ tạo task, thì task mới vẫn gắn mentor cũ; mentor cũ còn xóa được task, còn mentor mới không thấy task đó.
- **Cách sửa:** Tính `progress` khi đọc (query `COUNT`) thay vì lưu. Hoặc thêm `@Version` cho `InternProfile` để phát hiện xung đột.

### L2. Quản lý phiên: không dọn phiên hết hạn, không có idle timeout, token nằm trong `localStorage`
- **Vị trí:** `model/UserSession.java`, `AuthService.java:41-49`; `frontend/src/api.js:4`, `App.jsx:111`.
- **Kịch bản:** Bảng `user_sessions` tăng mãi vì mỗi lần login thêm một dòng và không có job xóa. Token sống đủ 12 giờ dù không hoạt động. Nếu sau này có XSS thì token trong `localStorage` bị đọc được. Rủi ro hiện thấp vì React escape output, không có `dangerouslySetInnerHTML`, và Electron đã bật sandbox.
- **Cách sửa:** Thêm `@Scheduled` gọi `deleteByExpiresAtBefore(Instant.now())` và `@EnableScheduling`. Cân nhắc thêm sliding expiry.

### L3. Dò email tồn tại qua thời gian phản hồi
- **Vị trí:** `AuthService.java:38-39`.
- **Kịch bản:** Email không tồn tại thì trả 401 ngay (khoảng 1 ms). Email có thật thì phải chạy BCrypt (khoảng 80 ms). Đo thời gian là biết email nào có tài khoản.
- **Cách sửa:** Khi không thấy user, vẫn gọi `encoder.matches(password, DUMMY_HASH)` trước khi ném 401.

### L4. Trạng thái hồ sơ `STOPPED`/`COMPLETED` không chặn hoạt động của intern
- **Vị trí:** `InternController.java:33` (chỉ lưu chuỗi trạng thái); `AuthService.java:36-43`, `ReportController.java:23`, `TaskController.java:40` (không kiểm tra `status`).
- **Kịch bản:** Intern đã "Tạm dừng" hoặc "Đã kết thúc" vẫn đăng nhập, nộp báo cáo và đổi trạng thái task bình thường.
- **Cách sửa:** Nếu nghiệp vụ yêu cầu (cần nhóm BA xác nhận), chặn login hoặc chặn ghi khi `status != ACTIVE`, trả 403.

### L5. Rút ngắn kỳ thực tập để lại task vi phạm BR04
- **Vị trí:** `InternController.java:45,60`.
- **Kịch bản:** Task có deadline 2027-06-01, sau đó Admin sửa `endDate` thành 2027-03-31. Task vẫn còn deadline ngoài kỳ, và mentor sửa tên task cũng bị 400 "Hạn công việc phải thuộc kỳ thực tập" (`TaskController.java:23`).
- **Cách sửa:** Khi cập nhật ngày, từ chối với 409 nếu còn task nằm ngoài khoảng mới, hoặc liệt kê task cần sửa.

### L6. Xóa phòng ban không tồn tại vẫn trả 200
- **Vị trí:** `AdminController.java:20`. Spring Data 3.x `deleteById` lặng lẽ bỏ qua id không tồn tại.
- **Kịch bản:** `DELETE /api/admin/departments/9999` trả `{"message":"Đã xóa phòng ban"}`, sai hợp đồng 404 ở docs/04.
- **Cách sửa:** `departments.delete(departments.findById(id).orElseThrow())`.

### L7. `today()` dùng UTC, lệch một ngày ở múi giờ Asia/Bangkok
- **Vị trí:** `frontend/src/App.jsx:11` (`new Date().toISOString().slice(0,10)`); dùng tại `:136` (ngày bắt đầu mặc định) và `:158` (đánh dấu quá hạn).
- **Kịch bản:** Lúc 06:30 sáng giờ Việt Nam, `today()` vẫn trả ngày hôm qua, nên task hết hạn hôm qua không được tô đỏ và form tạo intern điền sẵn ngày hôm qua.
- **Cách sửa:** `new Date().toLocaleDateString('sv-SE')` (định dạng YYYY-MM-DD theo giờ máy), hoặc tự ghép năm, tháng, ngày từ `getFullYear()`/`getMonth()`/`getDate()`.

### L8. Tài liệu lệch so với code
- `docs/04-api-contract.md:20,26,28` ghi POST/PUT task, review báo cáo, POST evaluation chỉ dành cho MENTOR, nhưng code cho cả ADMIN (`TaskController.java:26,30`, `ReportController.java:40`, `EvaluationController.java:19`). README:81,85 thì ghi Admin "Có".
- `docs/04:3,8` chỉ liệt kê `/auth/login`, thiếu `/auth/admin/login` và `/auth/intern/login` mà UI thực sự dùng (`App.jsx:109`).
- `docs/04:36` và `docs/05:46` dùng mật khẩu ví dụ `123456`, gắn với H1.
- README:30-37 ("Chạy nhanh nhất" bằng H2 + `client:browser`) và `docs/07:3` vẫn hướng dẫn chạy H2, trong khi UI đã cố ý chỉ nhận MySQL. Đây không phải nhắc lại quyết định ở App.jsx:96, mà là tài liệu chưa được cập nhật theo quyết định đó.
- **Cách sửa:** Cập nhật bảng quyền ở docs/04 cho khớp code, hoặc ngược lại. Bổ sung 2 endpoint portal. Đánh dấu luồng H2 chỉ dùng cho API/test.

### L9. `completionNote` không giới hạn độ dài, lỗi DB bị báo sai thành "trùng"
- **Vị trí:** `TaskController.java:45` (không kiểm tra độ dài); cột `length=2000` ở `TaskItem.java:17`; ánh xạ 409 ở `ApiExceptionHandler.java:17-18`. Email/tên mentor cũng không giới hạn 255 ký tự (`AdminController.java:17`).
- **Kịch bản:** Intern dán ghi chú 2.500 ký tự. MySQL strict báo "Data too long", và người dùng nhận 409 "Dữ liệu đang được sử dụng hoặc bị trùng", không biết phải sửa gì.
- **Cách sửa:** Kiểm tra `completionNote.length() <= 2000` và email ≤ 255, trả 400. Thêm `maxLength` cho textarea ở App.jsx:158.

### L10. Form "Cập nhật đánh giá" cho đổi intern, có thể ghi đè đánh giá của người khác
- **Vị trí:** `App.jsx:180` (dropdown `internId` vẫn đổi được khi `editing` có giá trị); `EvaluationController.java:22` (upsert theo `internId`).
- **Kịch bản:** Đang sửa đánh giá của A, lỡ chọn B rồi lưu: đánh giá cũ của B bị ghi đè mà không có cảnh báo.
- **Cách sửa:** `disabled={!!editing}` cho select khi sửa. Backend có thể tách thành `PUT /evaluations/{internId}`.

### L11. Chính sách mật khẩu chỉ kiểm tra độ dài; tính 72 theo ký tự thay vì byte
- **Vị trí:** `AdminController.java:21-22`, `InternController.java:37,48`, `AuthService.java:57`; frontend chỉ có `minLength={8}` (App.jsx:136,192,196).
- **Kịch bản:** Mật khẩu `12345678` được chấp nhận. Mật khẩu tiếng Việt có dấu 60 ký tự có thể vượt 72 byte UTF-8, và BCrypt (Spring Security 6.3.x đi kèm Boot 3.3.4) bỏ qua phần vượt quá mà không báo.
- **Cách sửa:** Gom kiểm tra vào một hàm `AuthService.validatePassword` (đang bị lặp ở 5 chỗ), kiểm tra `getBytes(UTF_8).length <= 72`, yêu cầu tối thiểu chữ và số, và chặn danh sách mật khẩu phổ biến.

### L12. `/api/mentors` trả email của mọi mentor cho cả INTERN
- **Vị trí:** `MetaController.java:13`.
- **Kịch bản:** Một intern bất kỳ lấy được tên và email của toàn bộ mentor. Rủi ro nhỏ nhưng là lộ dữ liệu cá nhân không cần thiết, vì UI intern không dùng endpoint này.
- **Cách sửa:** `requireRole(h, ADMIN, MENTOR)`, hoặc trả DTO không có email khi người gọi là INTERN.

### L13. Code chết hoặc thừa
- `desktop/ServerLauncher.cs` (WinForms launcher) không được file nào tham chiếu.
- `TaskRepository.countByStatus` (`TaskRepository.java:8`) không được dùng.
- `spring-boot-starter-validation` (`pom.xml:18`) có trong pom nhưng không có `@Valid` nào.
- Script `"sever"` (`package.json:6`, lỗi chính tả được giữ làm alias) và chuỗi "npm run sever" trong `App.jsx:95`, README:3.
- **Cách sửa:** Xóa hoặc dùng đúng. Giữ alias nếu nhóm đã quen, nhưng tài liệu nên dùng `npm run server`.

---

## Điểm tốt

- Token phiên là 256 bit từ `SecureRandom`; DB chỉ lưu SHA-256 của token (`AuthService.java:40-42`). Đổi mật khẩu, đổi mật khẩu bởi Admin, hoặc xóa tài khoản đều thu hồi mọi phiên (`revokeUser`).
- Mật khẩu băm bằng BCrypt; `User.password` có `@JsonIgnore` nên không bao giờ lộ ra JSON.
- Phân quyền và chống IDOR phía server nhất quán ở mọi controller (xem bảng ở trên). Không dựa vào việc UI ẩn nút.
- Ràng buộc dữ liệu ở DB: email unique, `(intern_id, week_number)` unique, nên báo cáo nộp trùng do race vẫn bị chặn và trả 409.
- Thứ tự trạng thái task (BR07) và chặn TODO→COMPLETED được kiểm tra ở server (`TaskController.java:43-44`).
- CORS chỉ cho phép danh sách origin cấu hình, không dùng `*`. Đã đặt `server.error.include-message=never` và `open-in-view=false`.
- Electron cấu hình an toàn: `contextIsolation`, `sandbox`, `nodeIntegration:false`, chặn `window.open`, chặn điều hướng khác origin, chống path traversal khi phục vụ `dist` (`main.cjs:53`), preload chỉ expose 2 hàm qua `contextBridge`.
- Không dùng `dangerouslySetInnerHTML`; React escape toàn bộ nội dung báo cáo và ghi chú.

## Bảng tổng hợp

| Mức độ | Số lượng | Mã |
|---|---:|---|
| Critical | 0 | — |
| High | 3 | H1–H3 |
| Medium | 9 | M1–M9 |
| Low | 13 | L1–L13 |
| **Tổng** | **25** | |

## Đề xuất thứ tự xử lý

1. H1 (seed và hiển thị mật khẩu), M1 (rate limit): rủi ro bảo mật trực tiếp.
2. H2 (UI Mentor): khoảng trống yêu cầu lớn nhất so với docs/02.
3. H3 (log và mã lỗi), M3 (điểm mặc định 0): lỗi đúng/sai và khả năng vận hành.
4. M4 (Java 17/21), M5 (test cho TC còn thiếu và CI): cần cho môn QLDAPM (bằng chứng kiểm thử).
5. M7, M6, M9, M8, rồi đến nhóm Low.

## Số liệu

- Test: 2 class, 3 phương thức, đều pass theo surefire report hiện có (JDK 17). Không chạy lại `mvn test` trong lần review này.
- Coverage: không đo (không có JaCoCo). Ước lượng: phần lớn nhánh 400/404/409 chưa có test.
- Lint: không có cấu hình ESLint hay Checkstyle, nên không có số liệu.
- Type: JavaScript thuần, không có TypeScript hay PropTypes.

## Câu hỏi còn mở

1. Mentor có cần UI riêng không, hay nhóm chấp nhận Admin làm thay Mentor? Câu trả lời quyết định cách sửa H2 và cách cập nhật docs/02.
2. Intern `STOPPED`/`COMPLETED` có bị khóa đăng nhập không (L4)?
3. Mục tiêu demo là 2 máy thật trong LAN hay một máy? Câu trả lời quyết định mức ưu tiên của M2 và M7.
