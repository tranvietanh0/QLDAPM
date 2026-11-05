# Review thay đổi chưa commit của IMS (sau các bản sửa H1/H2/H3/M1)

- Ngày: 2026-11-05 (Asia/Bangkok). Chỉ đọc, không sửa code.
- Tham chiếu: `plans/reports/code-reviewer-261105-1002-ims-full-review.md` và các báo cáo `fullstack-developer-261105-1015-*.md`, `tester-261105-1015-business-rule-tests.md`.
- Phạm vi: `ApiExceptionHandler.java`, `AuthController.java`, `AuthService.java`, `App.jsx`, `portal.js`, `pom.xml` (JaCoCo), `.github/workflows/ci.yml`, cùng các test mới `BusinessRuleTest`, `ErrorHandlingAndLoginLimitTest`, `MentorPortalTest`.
- Các quyết định đã chốt, không bàn lại: mentor dùng portal Admin; giữ tài khoản seed demo; khóa đăng nhập lưu trong bộ nhớ (5 lần sai trong 15 phút cho mỗi email thì trả 429); JaCoCo chỉ báo cáo, không đặt ngưỡng; CI dùng JDK 21, máy local dùng JDK 17.

## Kiểm chứng đã chạy

- Chạy `mvn -B -o -Djava.version=17 test` (Maven 3.9.9, JDK 17.0.20): **19 test, 0 fail, BUILD SUCCESS**. Chi tiết: AdminInternFlow 1, ApiIntegration 2, BusinessRule 8, ErrorHandlingAndLoginLimit 5, MentorPortal 3.
- `ErrorHandlingAndLoginLimitTest` chạy xong trong 0,695 s. Thời gian này cho thấy nó dùng lại Spring context của `ApiIntegrationTest`, vì hai class có cấu hình giống hệt nhau (xem N3).
- Kiểm tra phiên bản action bằng `gh api .../releases/latest`: checkout v7.0.1, setup-java v6.2.0, setup-node v7.1.0, upload-artifact v7.0.2. Cả bốn đều khớp major version trong `ci.yml`. `action.yml` của setup-java có input `cache-dependency-path`.
- Không chạy lại `npm run build`. Diff frontend nhỏ, và báo cáo của implementer đã ghi build thành công.

## 1. Trạng thái các phát hiện đã nhắm tới

| Mã | Trạng thái | Bằng chứng |
|---|---|---|
| H1 (phần UI) | **Fixed** | `App.jsx:87` không còn điền sẵn email (`useState('')`). Hộp demo ở `App.jsx:114` không còn in `admin@gmail.com` / `123456`, chỉ nhắc đổi mật khẩu mặc định. Đã grep `123456\|admin@gmail` trong `app/frontend/src`: không còn kết quả nào. |
| H1 (tổng thể) | **Partially** | Phần seed `123456` ở `DataSeeder.java:18-20` vẫn còn, theo đúng quyết định giữ tài khoản demo. Đây là rủi ro đã được chấp nhận. M1 làm giảm brute-force nhưng không chặn được việc đăng nhập đúng ngay lần đầu bằng mật khẩu đã công khai trong README:24. |
| H2 | **Fixed** (code) | Backend: `AuthController.java:11,16`, với `ADMIN_PORTAL={ADMIN,MENTOR}`. `AuthService.java:69` kiểm tra `portalRoles.contains(...)`. Frontend: `portal.js:4-5` (`allowedInPortal`) được dùng ở `App.jsx:110,201,202`. Đã kiểm tra role gating trong UI: menu và route Quản trị chỉ hiện khi `role==='ADMIN'` (`App.jsx:120,206`); nút tạo, sửa, xóa intern (`:144`) và xóa báo cáo (`:172`) cũng chỉ dành cho ADMIN. Các lệnh gọi `/admin/*` duy nhất nằm trong component `Administration` (`:187-188`), mà component này đã bị chặn bởi route. Không còn import `portalRole` nào (grep frontend/desktop/scripts). Backend vẫn tự trả 403 cho mentor ở `/api/admin/*`, đã có test (`MentorPortalTest.java:63-65`). Phần tài liệu còn thiếu được ghi ở L8. |
| H3 | **Fixed** (phần 1 và 2) | Log: `ApiExceptionHandler.java:44`, `log.error(..., e)` có stack trace và chỉ ghi phía server; response giữ thông báo chung. 404 ở `:31-32`, 405 kèm `Allow` ở `:33-39`, 415 ở `:40-41`; cả ba đều có test (`ErrorHandlingAndLoginLimitTest.java:30-48`). Còn lại phần 3: handler 409 (`:23-24`) vẫn không log và vẫn báo "trùng" khi dữ liệu quá dài. Phần này đã có trong L9 và vẫn mở. |
| M1 | **Fixed** (theo phạm vi đã chốt) | `AuthService.java:35-56,63-68`. Bộ đếm dùng key là email đã chuẩn hóa, áp dụng cho cả 3 endpoint login vì `login(email,pw)` gọi tiếp `login(...,null)`. Email đang bị khóa thì không chạy BCrypt. Đăng nhập đúng thì xóa bộ đếm. Có test cho 429 và cho việc reset. Còn hai lỗi mới trong phần cài đặt, ghi ở N1 và N2. |

Ngoài nhóm đã nhắm tới, các thay đổi này còn giải quyết phần lớn **M5**. CI đã có (`ci.yml`). Các TC04, 05, 08, 10, 13, 15, 16, 18 đã có test trong `BusinessRuleTest`. TC02 (401) được phủ trong test lockout, và luồng mentor có `MentorPortalTest`. Phần còn thiếu: frontend chưa có test hay lint, và `scripts/smoke-desktop.mjs` chưa có bước cho mentor. Tôi tính M5 là đã xử lý xong; các phần còn thiếu này nhỏ.

## 2. Phát hiện mới

### N1 [Medium]: Lockout không nguyên tử, nên một loạt request song song vượt xa giới hạn 5 lần
- **Vị trí:** `AuthService.java:65-67`. Thứ tự hiện tại là `rejectIfLocked`, rồi `findByEmail` và BCrypt (khoảng 60-100 ms), rồi mới đến `recordFailure`.
- **Kịch bản lỗi:** Kẻ tấn công gửi đồng thời 200 request đoán mật khẩu cho `admin@gmail.com`, giới hạn bởi thread pool Tomcat mặc định là 200. Mọi request đều qua `rejectIfLocked` khi bộ đếm còn 0, vì chưa request nào kịp ghi nhận lỗi. Kết quả là kẻ tấn công thử được khoảng 200 mật khẩu trong mỗi cửa sổ 15 phút thay vì 5, tức khoảng 19.000 lần mỗi ngày thay vì 480. 200 phép BCrypt chạy song song cũng làm nghẽn CPU, đúng phần DoS mà M1 muốn chặn. Implementer có ghi nhận là "có thể vượt 5 một chút", nhưng thực tế mức vượt bị chặn bởi số thread, không phải "một chút".
- **Cách sửa:** Giữ chỗ cho lần thử một cách nguyên tử trước khi chạy BCrypt, và xóa khi đăng nhập đúng:
  ```java
  FailedLogins f=failedLogins.compute(key,(k,o)->o==null||expired(o,now)?new FailedLogins(1,now)
      :o.count()>=MAX_FAILED_LOGINS?o:new FailedLogins(o.count()+1,o.windowStart()));
  if(f.count()>=MAX_FAILED_LOGINS && /* slot này không phải slot vừa được cấp */ ...) throw 429;
  ```
  Cách đơn giản hơn: đếm cả các lần thử đang chạy dở (tăng trước, kiểm tra `> MAX` thì trả 429), và khi đăng nhập đúng thì `remove(key)`. Thêm một test bắn 20 request song song bằng `ExecutorService` và assert có ít nhất 15 response 429.

### N2 [Medium]: Map lockout tăng không giới hạn và việc dọn dẹp tốn O(n) cho mỗi request
- **Vị trí:** `AuthService.java:40,53-55`. Email cũng không bị giới hạn độ dài (`AuthController.LoginRequest`, `AuthService.java:63`).
- **Kịch bản lỗi:** Email không tồn tại thì không chạy BCrypt (`:66-67`), nên mỗi request rất rẻ: chỉ một truy vấn DB rồi ghi vào map. Kẻ tấn công trong LAN chưa đăng nhập có thể gửi rất nhiều email ngẫu nhiên khác nhau. (a) `MAX_TRACKED_EMAILS` chỉ kích hoạt việc dọn các mục *đã hết hạn*. Trong 15 phút đầu không có mục nào hết hạn, nên map vẫn tăng quá 10.000 mà không có giới hạn. (b) Khi đã vượt 10.000, *mỗi* lần login sai lại chạy `values().removeIf(...)` quét toàn bộ map: 100.000 mục thì mỗi request quét 100.000 phần tử, chi phí tăng theo bậc hai. (c) Jackson 2.17 cho phép chuỗi dài tới 20 triệu ký tự, nên email dài vài trăm KB vẫn được lưu làm key. Khoảng 1.000 request như vậy đủ đẩy heap lên hàng trăm MB và có thể gây OOM. Toàn bộ server, kể cả với admin, ngừng hoạt động.
- **Cách sửa:** (1) Ở đầu `login`, nếu `email.length()>254` thì trả 401 ngay và không ghi vào map. (2) Dùng cấu trúc có giới hạn thật: `Caffeine.newBuilder().maximumSize(10_000).expireAfterWrite(15, MINUTES)`, hoặc `LinkedHashMap` LRU bọc trong `synchronized`. Nếu giữ `ConcurrentHashMap`, chỉ chạy dọn dẹp tối đa một lần mỗi phút (lưu `lastSweep`), và khi map vẫn đầy sau khi dọn thì bỏ mục cũ nhất.

### N3 [Low]: Test lockout dùng chung Spring context và tài khoản seed với `ApiIntegrationTest`
- **Vị trí:** `ErrorHandlingAndLoginLimitTest.java:16-21`, có cùng URL `internms_test` và cùng profile với `ApiIntegrationTest`, nên Spring dùng chung một context và một bean `AuthService` trong cache. Xem thêm `:65-73`.
- **Kịch bản lỗi:** `successfulLoginResetsFailureCounter` đưa tài khoản seed `mentor@gmail.com` lên 4 lần sai ngay trong context dùng chung đó. Nếu test này fail giữa chừng (ví dụ ở assert thứ 5), hoặc sau này có test nào trong cùng context thêm 1 lần login sai cho mentor, `ApiIntegrationTest.java:49` (`token("mentor@gmail.com")`) sẽ bị 429 tùy thứ tự chạy, và lỗi đó trông giống lỗi khác hẳn. Ngoài ra không có test nào cho việc hết cửa sổ 15 phút, vì không inject được `Clock`.
- **Cách sửa:** Dùng tài khoản riêng do test tạo ra, hoặc dùng URL H2 riêng (ví dụ `login_limit`) để context tách biệt. Inject `java.time.Clock` vào `AuthService` để test được nhánh hết hạn.

### N4 [Low]: `MentorPortalTest` không chứng minh được việc mentor chỉ thấy intern của mình
- **Vị trí:** `MentorPortalTest.java:59-61`. Comment ghi "Mentor sees only interns assigned to them", nhưng test chỉ `assertFalse(interns.isEmpty())`.
- **Kịch bản lỗi:** DB `mentor_portal` chỉ có đúng 1 intern seed, và intern này lại được gán cho mentor đó. Vì vậy nếu ai đó bỏ bộ lọc ở `InternController:19`, test vẫn pass. Assertion này không có tác dụng, dù quy tắc dữ liệu theo vai trò là điều kiện an toàn chính của H2.
- **Cách sửa:** Dùng admin tạo thêm một mentor và một intern thứ hai, sau đó assert danh sách của mentor seed không chứa intern đó, và `GET /api/interns/{id}` của intern đó trả 403.

### Ghi chú (không tính là lỗi mới)
- **L3 vẫn mở và nay mâu thuẫn với comment.** `AuthService.java:35` ghi bộ đếm lỗi "does not reveal which accounts exist". Nhưng khi email không tồn tại thì `:66-67` không chạy BCrypt, nên vẫn dò được email qua thời gian phản hồi. Nên sửa L3 bằng dummy hash, hoặc sửa comment.
- **L8 có thêm phần tài liệu lệch.** `app/docs/04-api-contract.md:57` chưa có mã 405/415/429. `docs/04:8` vẫn chỉ có `/auth/login`, chưa có hai endpoint portal và việc portal Admin nhận cả mentor. `README.md:119` vẫn ghi "cần thêm giới hạn thử đăng nhập".
- **Phần đã kiểm tra, không có lỗi:**
  - Header `Allow` lấy từ `getSupportedHttpMethods()` và có kiểm tra null.
  - Log không chứa body hay mật khẩu, vì `HttpMessageNotReadableException` và `DataIntegrityViolationException` có handler riêng và không log.
  - `/api/auth/login` vẫn nhận mọi vai trò như trước. Kiểm tra portal không phải ranh giới bảo mật; quyền thật được kiểm tra bằng `requireRole` ở từng endpoint, và test đã xác nhận mentor bị 403 ở `/api/admin/departments`.
  - Đăng nhập đúng nhưng sai portal (403) vẫn xóa bộ đếm. Hành vi này chấp nhận được, vì để làm vậy phải biết mật khẩu đúng.
  - Các ngày cố định trong test (2026-12-01, tuần 40) nằm trong kỳ seed 2026-09-01..2027-06-30, và không có kiểm tra nào so với `now()`, nên test không bị lỗi theo thời gian.
- **CI (`ci.yml`): đúng.**
  - Đường dẫn: `working-directory` chỉ áp dụng cho bước `run`, còn `upload-artifact` dùng đường dẫn tính từ workspace (`app/backend/target/site/jacoco/`), nên cả hai đều đúng.
  - Cache: khóa theo `app/backend/pom.xml` và `app/frontend/package-lock.json`, cả hai file đều tồn tại.
  - awk: các cột 6-9 của `jacoco.csv` là BRANCH_MISSED/COVERED và LINE_MISSED/COVERED, đúng như workflow dùng.
  - Hạn chế nhỏ: khi `mvn verify` fail ở phase test thì goal `report` (gắn vào phase `verify`) không chạy, nên bảng độ phủ chỉ hiện dòng "JaCoCo report not found". Hành vi này chấp nhận được.
  - Runner `ubuntu-latest` có sẵn Maven; repo không có `mvnw`.
- **Khi commit:** `git status` còn các file không liên quan (`src/build_agent_report.py`, `src/capture_report_figures.mjs`, `docs/figures/`, `plans/reports/`). Nên `git add` có chọn lọc, tách thành từng commit theo chủ đề (fix lỗi, feat mentor portal, test, ci).

## 3. Tổng số lỗi cập nhật cho toàn bộ codebase

Trước đây là 0/3/9/13 (Critical/High/Medium/Low).

| Mức độ | Trước | Thay đổi | Hiện tại |
|---|---:|---|---:|
| Critical | 0 | | **0** |
| High | 3 | −H2, −H3 (H1 vẫn mở vì rủi ro seed đã được chấp nhận) | **1** |
| Medium | 9 | −M1, −M5, +N1, +N2 | **9** |
| Low | 13 | +N3, +N4 (phần tài liệu gộp vào L8, phần 409 nằm trong L9) | **15** |
| **Tổng** | 25 | | **25** |

## 4. Đề xuất thứ tự xử lý

1. N2: giới hạn độ dài email và dùng map có giới hạn thật. Sửa ít dòng, nhưng chặn được nguy cơ OOM từ request chưa đăng nhập.
2. N1: giữ chỗ lần thử nguyên tử trước BCrypt và thêm test song song.
3. N3, N4: tách context cho test lockout, và thêm intern thứ hai để test thật sự kiểm tra bộ lọc của mentor.
4. Cập nhật tài liệu L8 (405/415/429, endpoint portal, README:119).

## Kết luận

**Sẵn sàng commit: Có.**

Các thay đổi đạt mục tiêu: H2, H3 và M1 đã sửa, phần UI của H1 đã sửa. Không có regression: 19/19 test pass, phân quyền frontend và backend đúng, CI đúng. N1 và N2 là điểm yếu trong cơ chế lockout mới. Chúng không làm tình hình tệ hơn trước khi có lockout, vì trước đó hoàn toàn không có giới hạn. Ngoại lệ là OOM ở N2, chỉ xảy ra với request rất lớn hoặc số lượng request rất nhiều. Nên sửa N2 trước khi demo qua LAN, nhưng không cần chặn commit.

## Câu hỏi còn mở

- Có chấp nhận thêm dependency Caffeine cho N2 không, hay giữ `ConcurrentHashMap` kèm dọn dẹp có giới hạn tần suất?
