# Gia cố khóa đăng nhập (N1-N4)

- Ngày: 2026-11-05 (Asia/Bangkok). Chưa commit. Nền: HEAD 4688391.
- Nguồn phát hiện: `plans/reports/code-reviewer-261105-1024-changes-review.md` (N1-N4) và `plans/reports/tester-261105-1024-regression-after-fixes.md` mục 7.1.
- File đã sửa (chỉ 3 file):
  - `app/backend/src/main/java/com/example/internms/service/AuthService.java`
  - `app/backend/src/test/java/com/example/internms/ErrorHandlingAndLoginLimitTest.java`
  - `app/backend/src/test/java/com/example/internms/MentorPortalTest.java`
- Không sửa `AuthController`, `pom.xml`, tài liệu hay CI. Không thêm dependency.

## Kết quả kiểm chứng

Lệnh: `cd app/backend && mvn -B -o -Djava.version=17 verify` (Maven 3.9.9, JDK 17).

```
Tests run: 1,  Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.AdminInternFlowTest
Tests run: 2,  Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.ApiIntegrationTest
Tests run: 8,  Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.BusinessRuleTest
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.ErrorHandlingAndLoginLimitTest
Tests run: 4,  Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.MentorPortalTest
Tests run: 25, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Trước khi sửa có 19 test. Thêm 6 test: 5 test trong `ErrorHandlingAndLoginLimitTest` và 1 test trong `MentorPortalTest`.

## N1 (Medium): đếm lần thử không nguyên tử

**Thay đổi:** Bỏ cặp `rejectIfLocked` và `recordFailure`, thay bằng `reserveAttempt`.

- Mỗi request giữ chỗ một lần thử bằng `ConcurrentHashMap.compute`. Việc này xảy ra *trước* `findByEmail` và BCrypt.
- Bộ đếm là số lần thử trong cửa sổ, tối đa `MAX+1` để không bị tràn số.
- Nếu `count > 5` thì trả 429 ngay, kèm số phút còn lại. Vì vậy mỗi email chỉ được kiểm tra tối đa 5 mật khẩu trong một cửa sổ 15 phút, kể cả khi nhiều request đến cùng lúc.
- Đăng nhập đúng thì xóa mục (`remove`).
- Hành vi tuần tự giữ nguyên: 5 lần sai đều trả 401, lần thứ 6 trả 429. Test cũ `fiveFailedLoginsLockTheEmailWith429` vẫn pass.

**Test:**

- `concurrentWrongPasswordsOverHttpEvaluateAtMostFive`: bắn 20 request HTTP song song (cùng chờ một `CountDownLatch`) cho một email giả. Assert đúng 5 response 401 và 15 response 429.
- `concurrentWrongPasswordsAgainstBcryptAccountCheckAtMostFivePasswords`: chạy với `AuthService` độc lập và tài khoản có hash BCrypt thật. Kiểm tra BCrypt chậm, nên đây là khe hở của cách cũ. Test bắn 20 lần gọi song song và assert 5 lần 401, 15 lần 429. Test cũng dùng `verify(users, times(5)).findByEmail(...)` để xác nhận chỉ có 5 lần kiểm tra mật khẩu.

## N2 (Medium): map không giới hạn và quét O(n) mỗi request

**Thay đổi trong `AuthService`:**

- Email (đã trim) dài hơn 254 ký tự bị trả **400** "Email không hợp lệ" trước khi chạm vào map. Kiểm tra này nằm trong `AuthService`, nên áp dụng cho cả 3 endpoint login; không cần sửa `AuthController`.
- Giới hạn `MAX_TRACKED_EMAILS = 10_000` nay được thực thi thật. Khi map đã đầy và key là key mới, `makeRoom` chạy như sau:
  1. Dọn các mục đã hết hạn bằng một lần quét toàn bộ. Lần quét này bị giới hạn tối đa **1 lần mỗi phút** (`AtomicReference<Instant> lastPrune` kết hợp CAS), nên chỉ một thread được quét.
  2. Nếu map vẫn đầy, bỏ đi **1 mục**. Hàm xem tối đa 8 mục đầu, chọn mục đầu tiên chưa bị khóa; nếu cả 8 đều đang khóa thì bỏ mục đầu tiên. Chi phí luôn bị chặn, không quét toàn bộ map.
- Kích thước map chỉ có thể vượt 10.000 một chút, tối đa bằng số request đồng thời (thread pool), vì bước kiểm tra kích thước và bước thêm mục không nằm trong cùng một khóa.
- Không dùng Caffeine, theo quyết định của user.
- **Trade-off đã ghi trong comment:** nếu bị flood hơn 10.000 email khác nhau trong 15 phút, một bộ đếm *chưa khóa* có thể bị bỏ và đếm lại từ 0. Email *đang khóa* được ưu tiên giữ lại.
- **Comment về dò email đã được sửa cho đúng.** Comment cũ ghi rằng bộ đếm không làm lộ tài khoản nào tồn tại. Comment mới ghi: email không tồn tại được đếm giống hệt email thật, nhưng không chạy BCrypt, nên thời gian phản hồi vẫn có thể cho biết tài khoản có tồn tại hay không. Cơ chế này giới hạn việc đoán mật khẩu, không chặn được việc dò email. L3 vẫn mở.

**Test:**

- `overlongEmailIsRejectedWith400`: email 262 ký tự luôn trả 400, kể cả sau 7 lần gửi, và không bao giờ chuyển thành 429. Email đúng 254 ký tự vẫn được xử lý bình thường và trả 401.
- `trackedEmailsStayBoundedAndLockedEntriesSurviveAFlood`: test chạy theo các bước sau.
  1. Khóa một email.
  2. Flood 10.500 email khác.
  3. Assert map có không quá 10.000 mục (đọc bằng reflection, chỉ trong test), và email đang khóa vẫn trả 429.
  4. Tua đồng hồ thêm 16 phút, rồi gửi một email mới. Bước dọn chạy và map chỉ còn 1 mục.

## N3 (Low): test lockout dùng chung context và tài khoản seed

**Thay đổi:**

- **Test HTTP** của lockout chỉ dùng email giả ngẫu nhiên (`fakeEmail(...)`). Không test nào còn gửi mật khẩu sai cho `mentor@gmail.com` hay tài khoản seed khác. Vì vậy dùng chung Spring context với `ApiIntegrationTest` là an toàn và vẫn giữ được tốc độ.
- **Test cần mật khẩu đúng hoặc cần đồng hồ chạy** tạo `AuthService` độc lập. Service này dùng repository mock (Mockito có sẵn trong `spring-boot-starter-test`) và tài khoản giả `user@example.com`, không đụng tới Spring context.
- **Đồng hồ được inject vào `AuthService`.**
  - Constructor `@Autowired AuthService(users, sessions)` gọi sang `AuthService(users, sessions, Clock)` với `Clock.systemUTC()`.
  - Constructor 3 tham số dùng cho test.
  - Clock chỉ điều khiển cửa sổ lockout. Thời hạn session vẫn dùng `Instant.now()`, để giữ phạm vi thay đổi hẹp.

**Test:**

- `successfulLoginResetsTheCounterButNotWhileLocked`: 4 lần sai rồi 1 lần đúng, lặp lại hai lần, đều không bị khóa. Sau đó 5 lần sai liên tiếp khiến cả mật khẩu đúng cũng nhận 429.
- `lockExpiresAfterTheFifteenMinuteWindow`: dùng `MutableClock`. Ở mốc 14 phút 59 giây vẫn trả 429, thông báo có "1 phút". Ở đúng mốc 15 phút, đăng nhập đúng trả 200.

## N4 (Low): `MentorPortalTest` không chứng minh mentor chỉ thấy intern của mình

**Thay đổi:** Thêm test `mentorsOnlySeeTheirOwnInternsTasksAndReports`. Admin tạo mentor B (`/api/admin/mentors`) và intern B gán cho mentor B (`/api/interns`), sau đó test kiểm tra:

- **Intern:**
  - Danh sách của mentor A không chứa intern B.
  - Danh sách của mentor B chỉ có đúng intern B.
  - `GET /api/interns/{id}` chéo giữa hai mentor trả 403 theo cả hai chiều.
- **Task:**
  - Task của mentor B không xuất hiện trong `/api/tasks` của mentor A.
  - Mentor B chỉ thấy đúng task của mình.
  - Mentor A tạo task cho intern B thì bị 403.
- **Báo cáo:**
  - Báo cáo tuần của intern B không có trong `/api/reports` của mentor A.
  - Mentor B thấy đúng báo cáo đó.

Đổi comment cũ "Mentor sees only interns assigned to them" ở test cũ cho đúng với điều test đó thực sự kiểm tra. Test dùng DB `mentor_portal` riêng, và mọi lần đăng nhập ở đây đều đúng mật khẩu.

## Giới hạn và ghi chú

- Chưa chạy test song song trên code cũ để thấy nó fail, vì code cũ không có constructor nhận `Clock` nên test không biên dịch được. Lập luận cho thấy test sẽ bắt được lỗi cũ: thứ tự cũ là kiểm tra khóa, rồi BCrypt khoảng 60-100 ms, rồi mới ghi lỗi, nên cả 20 request đều qua được bước kiểm tra khóa. Tương tự, chưa thử gỡ bộ lọc ở `InternController` để thấy test N4 fail, vì file đó nằm ngoài phạm vi được sửa. Các assert `assertFalse(internsA.contains(internBId))` sẽ fail nếu `findAll` trả về mọi intern.
- Khóa vẫn theo email (không theo IP) và chỉ lưu trong bộ nhớ, theo quyết định đã chốt.

## Câu hỏi còn mở

- Có muốn sửa L3 (dò email qua thời gian phản hồi) bằng cách chạy BCrypt với một dummy hash khi email không tồn tại không? Lần này chỉ sửa comment cho đúng, theo yêu cầu.
