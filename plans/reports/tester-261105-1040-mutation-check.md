# Báo cáo kiểm tra đột biến: khóa đăng nhập và cô lập mentor

Ngày: 2026-11-05
Phạm vi: các thay đổi chưa commit trong `AuthService.java`, `ErrorHandlingAndLoginLimitTest.java` và `MentorPortalTest.java`.
Phương pháp: tạo worktree tạm từ HEAD (`4688391`), chép phiên bản hiện tại của ba file trên vào đó, áp từng đột biến một, chạy đúng test class liên quan, rồi khôi phục. Working tree thật không bị sửa.

## Kết luận

- Cả 6 đột biến đều bị phát hiện: mutation score 6/6 (100%). Mỗi đột biến làm ít nhất một test thất bại.
- Có một khoảng trống: test HTTP `concurrentWrongPasswordsOverHttpEvaluateAtMostFive` không phát hiện đột biến M1 (ghi nhận lần thử sai sau khi BCrypt chạy xong, tức race N1). Chỉ test standalone `concurrentWrongPasswordsAgainstBcryptAccountCheckAtMostFivePasswords` bắt được lỗi này. Chi tiết ở mục "Vấn đề cần xử lý".
- Trên bản không đột biến, toàn bộ suite backend pass: 25 test, 0 lỗi.

## Kết quả đột biến

| # | Đột biến | File bị sửa (chỉ trong bản sao) | Test kỳ vọng thất bại | Kết quả thực tế | Dòng Maven summary |
|---|----------|----------------------------------|----------------------|-----------------|--------------------|
| M1 | Đưa việc ghi nhận lần thử sai xuống sau kiểm tra BCrypt | `service/AuthService.java` | Hai test concurrency | KILLED một phần. Ba test thất bại: `concurrentWrongPasswordsAgainstBcryptAccountCheckAtMostFivePasswords` (dòng 181: `findByEmail` gọi 20 lần thay vì 5), `successfulLoginResetsTheCounterButNotWhileLocked` (dòng 193: tài khoản đang khóa vẫn đăng nhập được, nhận 200), `lockExpiresAfterTheFifteenMinuteWindow` (dòng 200). Test HTTP `concurrentWrongPasswordsOverHttpEvaluateAtMostFive` SURVIVED. | `[ERROR] Tests run: 10, Failures: 3, Errors: 0, Skipped: 0`, BUILD FAILURE |
| M2 | Bỏ kiểm tra email dài hơn 254 ký tự | `service/AuthService.java` | `overlongEmailIsRejectedWith400` | KILLED. `Status expected:<400> but was:<401>` (dòng 162). | `[ERROR] Tests run: 10, Failures: 1, Errors: 0, Skipped: 0`, BUILD FAILURE |
| M3 | Tắt cơ chế giới hạn và loại bớt entry trong `makeRoom` (`if(true) return;`) | `service/AuthService.java` | `trackedEmailsStayBoundedAndLockedEntriesSurviveAFlood` | KILLED. `tracked: 10501`, kỳ vọng `<= 10000` (dòng 222). | `[ERROR] Tests run: 10, Failures: 1, Errors: 0, Skipped: 0`, BUILD FAILURE |
| M4 | Đổi cửa sổ khóa từ 15 phút thành 30 phút | `service/AuthService.java` | `lockExpiresAfterTheFifteenMinuteWindow` | KILLED. Thất bại ở dòng 206 (chuỗi "1 phút" không khớp, vì còn khoảng 15 phút). Test flood cũng thất bại ở dòng 229: `expected 1 but was 10000`. | `[ERROR] Tests run: 10, Failures: 2, Errors: 0, Skipped: 0`, BUILD FAILURE |
| M5 | Bỏ lọc intern theo mentor ở danh sách (`findAll()` thay vì `findByMentorId`) | `controller/InternController.java` | `mentorsOnlySeeTheirOwnInternsTasksAndReports` | KILLED. `expected: <false> but was: <true>` tại dòng 129 (mentor A thấy intern của mentor B). | `[ERROR] Tests run: 4, Failures: 1, Errors: 0, Skipped: 0`, BUILD FAILURE (MentorPortalTest) |
| M6 | Cho phép chuyển trực tiếp TODO sang COMPLETED | `controller/TaskController.java` | `internCannotMoveTaskFromTodoDirectlyToCompleted` (BusinessRuleTest) | KILLED. `expected: <400> but was: <200>` tại dòng 116. | `[ERROR] Tests run: 8, Failures: 1, Errors: 0, Skipped: 0`, BUILD FAILURE (BusinessRuleTest) |

Mutation score: 6/6 đột biến bị phát hiện (100%). Xét theo từng cặp đột biến và test kỳ vọng, 6 trên 7 cặp được phát hiện. Cặp còn lại là test HTTP trong M1.

## Số liệu nền và suite đầy đủ

- Trước khi đột biến, ba class liên quan (`ErrorHandlingAndLoginLimitTest`, `MentorPortalTest`, `BusinessRuleTest`) chạy trên bản không đột biến: 22 test, 0 lỗi, 0 thất bại (đọc từ surefire XML, vì lần chạy đó dùng `-q` nên không có dòng summary).
- Suite backend đầy đủ trên bản không đột biến: `Tests run: 25, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS, tổng thời gian 25.0 s. Phân bổ: `AdminInternFlowTest` 1, `ApiIntegrationTest` 2, `BusinessRuleTest` 8, `ErrorHandlingAndLoginLimitTest` 10, `MentorPortalTest` 4.
- Thời gian: `AdminInternFlowTest` mất khoảng 9.5 s (phần lớn là khởi động Spring context). Không có test nào đáng kể là chậm.

## Ghi chú phương pháp

- M3 ban đầu được viết là `return;` và gây lỗi biên dịch (`unreachable statement`), nên không phải kết quả test. Lần đó đã bị loại bỏ. Lần chạy hợp lệ dùng `if(true) return;`, javac chấp nhận và vẫn tắt được cơ chế giới hạn.
- Mỗi đột biến chỉ chạy một lần. Chưa kiểm tra tính flaky của các test concurrency bằng cách chạy lặp lại.
- Log từng lần chạy và diff của từng đột biến nằm trong thư mục scratchpad của phiên làm việc, không nằm trong repo.
- Worktree tạm đã được xóa bằng `git worktree remove --force` và `git worktree prune`. `git worktree list` chỉ còn repo chính.

## Vấn đề cần xử lý

1. **Test HTTP concurrency không bắt được race N1 (mức ưu tiên cao).** `concurrentWrongPasswordsOverHttpEvaluateAtMostFive` chỉ kiểm tra số mã 401 (5) và 429 (15). Mã nguồn bị đột biến M1 vẫn cho đúng hai con số này, vì việc đặt chỗ vẫn nguyên tử, nên test không phát hiện được lỗi. Tên test nói "evaluate at most five" nhưng test không đếm số lần đánh giá mật khẩu. Hướng xử lý: giữ test HTTP để kiểm tra hành vi, và dựa vào test standalone đếm `findByEmail` làm lưới bắt race. Hoặc đổi tên test để không hứa điều nó không kiểm tra. Tôi không sửa test vì đây là quyết định về phạm vi.
2. **Nhãn "TC10" không tồn tại trong repo.** `BusinessRuleTest.java` không có nhãn TC10. Test tương ứng với M6 là `internCannotMoveTaskFromTodoDirectlyToCompleted`.
3. **Thay đổi không do tôi tạo xuất hiện trong repo chính.** Trong lúc chạy, một file untracked mới xuất hiện: `plans/reports/code-reviewer-261105-1040-lockout-hardening-review.md`. Đây là file do agent khác ghi. Tôi không chạm vào file này.
4. **Một tiến trình Java không thuộc tác vụ này vẫn đang chạy.** PID 6594 (bắt đầu lúc 10:26) có thư mục làm việc là `app/backend` của repo chính và có biến môi trường DB. Tôi không dừng tiến trình này, vì nó không do tôi khởi động. Tiến trình trên `:8081` cũng không bị động tới.

## Việc tiếp theo (theo thứ tự ưu tiên)

1. Quyết định cách xử lý test HTTP concurrency (sửa assertion, đổi tên, hoặc giữ nguyên và ghi chú rõ). Đây là quyết định của người dùng.
2. Chạy lặp `ErrorHandlingAndLoginLimitTest` và `MentorPortalTest` khoảng 5 lần để kiểm tra flaky, đặc biệt với các test concurrency.
3. Xác nhận chủ sở hữu tiến trình PID 6594 và file untracked nói trên trước khi commit.

## Câu hỏi chưa được giải quyết

- Có nên sửa test HTTP concurrency ngay trong phiên này, hay để đó để người dùng quyết định?
- Tiến trình PID 6594 thuộc về ai, và có cần dừng nó không?
