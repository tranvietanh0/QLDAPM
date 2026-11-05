# Sửa lỗi xử lý exception (H3) và giới hạn đăng nhập sai (H1 một phần, M1)

Ngày: 2026-11-05. Chưa commit.

## File đã thay đổi

- `app/backend/src/main/java/com/example/internms/controller/ApiExceptionHandler.java`
- `app/backend/src/main/java/com/example/internms/service/AuthService.java`
- `app/frontend/src/App.jsx` (component `Login`)
- Mới: `app/backend/src/test/java/com/example/internms/ErrorHandlingAndLoginLimitTest.java`

`AuthController.java` không cần sửa vì toàn bộ logic giới hạn nằm trong `AuthService.login`, mà cả 3 endpoint login đều gọi hàm này. `DataSeeder` và các tài khoản demo giữ nguyên.

## Hành vi trước và sau

| Trường hợp | Trước | Sau |
|---|---|---|
| `GET /api/does-not-exist` | 500, không log | 404 `{"error":"Không tìm thấy đường dẫn yêu cầu"}` |
| `GET /api/admin/departments` (chỉ có POST) | 500 | 405 kèm header `Allow`, `{"error":"Phương thức không được hỗ trợ cho đường dẫn này"}` |
| `POST /api/auth/login` với `text/plain` | 500 | 415 `{"error":"Định dạng dữ liệu không được hỗ trợ, hãy gửi JSON"}` |
| Exception không lường trước | 500, nuốt lỗi | 500 với cùng thông báo cũ, đồng thời log `ERROR` qua SLF4J kèm stack trace. Response không chứa stack trace. |
| `ResponseStatusException` | Giữ nguyên | Giữ nguyên |
| Đăng nhập sai 5 lần liên tiếp cho cùng email trong 15 phút | Không giới hạn | Lần thứ 6 trở đi bị 429 `{"error":"Đăng nhập sai quá nhiều lần, vui lòng thử lại sau N phút"}`, kể cả khi mật khẩu đúng, cho đến hết cửa sổ 15 phút. Không tốn BCrypt khi đang bị khóa. |
| Đăng nhập đúng | Không có bộ đếm | Xóa bộ đếm của email đó |
| Màn hình đăng nhập Admin | Điền sẵn `admin@gmail.com`, hiển thị mật khẩu `123456` | Ô email trống. Hộp gợi ý chỉ nhắc dùng tài khoản được cấp và đổi mật khẩu mặc định. |

Chi tiết bộ giới hạn:

- Lưu trong bộ nhớ (`ConcurrentHashMap`), key là email đã `trim` và chuyển thường.
- Đếm cả với email không tồn tại, nên không lộ email nào có tài khoản.
- Cửa sổ 15 phút bắt đầu từ lần sai đầu tiên.
- Khi map vượt 10.000 email, các mục đã hết hạn sẽ được dọn.

## Bằng chứng kiểm thử

`mvn -B -Djava.version=17 test`:

```
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.AdminInternFlowTest
Tests run: 2, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.ApiIntegrationTest
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.BusinessRuleTest
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.internms.ErrorHandlingAndLoginLimitTest
Tests run: 16, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Các test mới:

- 404 (body JSON)
- 405 (header `Allow` chứa POST)
- 415
- Khóa 429 sau 5 lần sai, có kiểm tra chuẩn hóa email và đảm bảo email khác không bị ảnh hưởng
- Đăng nhập đúng reset bộ đếm (4 sai, 1 đúng, 4 sai, 1 đúng)

`npm run build` (frontend): build thành công bằng vite 5.4.8.

## Rủi ro còn lại

- Bộ đếm mất khi restart server và không chia sẻ giữa nhiều instance. Với ứng dụng desktop một server thì chấp nhận được.
- Khi có nhiều request song song cùng lúc, số lần thử có thể vượt 5 một chút, vì bước kiểm tra và bước ghi nhận không nguyên tử.
- Kẻ tấn công có thể cố ý khóa một email đã biết trong 15 phút (DoS có giới hạn). Đây là đánh đổi chuẩn khi khóa theo email.
- Mật khẩu demo `123456` vẫn được seed, theo đúng quyết định chấp nhận rủi ro.
