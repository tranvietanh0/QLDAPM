# Báo cáo triển khai: khóa đăng nhập dùng key chuẩn hóa (N6), ghi nhận N5, đổi tên test HTTP

Trạng thái: hoàn thành. `mvn -o -B -Djava.version=17 verify` pass, 26/26 test. Chưa commit.

## File đã sửa
- `app/backend/src/main/java/com/example/internms/service/AuthService.java`
- `app/backend/src/test/java/com/example/internms/ErrorHandlingAndLoginLimitTest.java`

## Thay đổi

### N6 (đã sửa)
- `login()` bây giờ gọi `findByEmail` trước, rồi mới giữ chỗ lượt thử. Bước tra cứu này chưa chạy BCrypt. Khi tìm thấy user, key khóa là email đã lưu của user (sau trim và lower-case). Khi không tìm thấy, key là chuỗi người dùng nhập sau khi chuẩn hóa. Vì vậy mọi biến thể như "ádmin@..." và "admin@..." dùng chung một bộ đếm. Đăng nhập thành công xóa đúng key chuẩn hóa này.
- Đảm bảo của N1 vẫn giữ nguyên: lượt thử được giữ chỗ nguyên tử (`compute`) TRƯỚC `encoder.matches`. Kiểm tra độ dài 254 ký tự vẫn chạy trước mọi thao tác khác (400, không đụng DB).
- Hệ quả: `findByEmail` giờ chạy ở mọi request, kể cả request bị 429. Test BCrypt chạy đồng thời trước đây đếm số lần gọi `findByEmail` để suy ra số lần chạy BCrypt, nên không còn dùng được. Test này giờ đếm `getPassword()` trên user spy, tức là đếm đúng số lần BCrypt chạy, và vẫn yêu cầu đúng 5 lần.
- Test mới `emailVariantsResolvingToOneAccountShareOneCounter`: repo mock trả về cùng một user cho "user@example.com" và "úser@example.com". Test gửi 3 lần sai với biến thể A và 2 lần sai với biến thể B. Lần thứ 6 nhận 429 ở cả hai biến thể, kể cả khi nhập đúng mật khẩu.
- Kiểm tra đột biến: đổi `reserveAttempt(lockKey,` về `reserveAttempt(key,` thì test mới fail (`expected 429 but was 200`). File đã được khôi phục sau khi kiểm tra.

### N5 (user chấp nhận là rủi ro tồn dư, không đổi logic loại mục)
- Comment ở đầu phần throttle đã nói rõ: khi map đầy các mục đang khóa, một loạt email giả có thể đẩy một mục đang khóa ra khỏi map và reset bộ đếm của nó. Chi phí tấn công bị giới hạn bởi trần 10.000 mục (khoảng 300k request), nhưng rủi ro này không bị ngăn chặn.
- Test flood được đổi tên thành `trackedEmailsStayBoundedAndUnlockedFloodEntriesAreEvictedBeforeALockedOne`. Comment trong test ghi rõ test chỉ bao phủ flood các mục chưa khóa, và trường hợp map đầy mục đã khóa là rủi ro được chấp nhận.

### Ghi chú từ mutation check
- `concurrentWrongPasswordsOverHttpEvaluateAtMostFive` được đổi tên thành `concurrentWrongPasswordsOverHttpReturnFive401ThenLocked`. Thêm một dòng comment: test này chỉ kiểm tra mã trạng thái, còn race condition được bao phủ bởi test đếm BCrypt chạy độc lập.

## Kết quả kiểm thử
```
Tests run: 1,  Failures: 0, Errors: 0 -- AdminInternFlowTest
Tests run: 2,  Failures: 0, Errors: 0 -- ApiIntegrationTest
Tests run: 8,  Failures: 0, Errors: 0 -- BusinessRuleTest
Tests run: 11, Failures: 0, Errors: 0 -- ErrorHandlingAndLoginLimitTest
Tests run: 4,  Failures: 0, Errors: 0 -- MentorPortalTest
Tests run: 26, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## Câu hỏi còn mở
- `app/docs/04-api-contract.md` nằm ngoài phạm vi file được phép sửa. Nếu docs đó mô tả key khóa là "email đã nhập" hoặc nói rằng mục đã khóa luôn được giữ lại khi flood, cần cập nhật docs ở một bước riêng.
