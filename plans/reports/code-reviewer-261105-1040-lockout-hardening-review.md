# Review: lockout hardening (chưa commit)

Phạm vi: `git diff` của `AuthService.java`, `ErrorHandlingAndLoginLimitTest.java`, `MentorPortalTest.java`, `app/docs/04-api-contract.md` (1 dòng).
Đối chiếu với N1-N4 trong `plans/reports/code-reviewer-261105-1024-changes-review.md`.
Ràng buộc đã chốt, không bàn lại: không thêm dependency, lockout lưu in-memory và tính theo email, giữ tài khoản seed.

Kiểm chứng:
- `mvn -o -B -Djava.version=17 test`: 25/25 test pass, BUILD SUCCESS (khoảng 35 giây).
- Viết một bản mô phỏng logic `makeRoom`/`reserveAttempt` trong scratchpad để kiểm tra N5.

## Trạng thái N1-N4

| ID | Trạng thái | Bằng chứng |
|----|-----------|-----------|
| N1 (lockout không nguyên tử) | **Fixed** | `AuthService.java:74-82`: mỗi lần thử được giữ chỗ bằng `ConcurrentHashMap.compute` trước `findByEmail`/BCrypt (`:91` rồi mới đến `:92-93`). Bộ đếm dừng ở 6 (`:77`), lần thử thứ 6 trở đi bị 429. Không có đường nào bỏ qua bước giữ chỗ: khi email hoặc password null, `:88` trả 401 mà không kiểm tra mật khẩu; email dài bị chặn với 400 ở `:90`; endpoint chung `/api/auth/login` gọi `login(e,p)` rồi đi tới `login(e,p,null)` (`AuthController:15`, `AuthService:84`), nên dùng chung một đường xử lý. Test `:167-182` có `verify(times(5)) findByEmail` với BCrypt thật, đây là bằng chứng mạnh. Riêng N6 bên dưới là đường vượt qua ở tầng key, không phải ở tầng nguyên tử. |
| N2 (map không giới hạn, dọn dẹp O(n) mỗi request) | **Fixed** (có rủi ro mới, xem N5) | Email dài hơn 254 ký tự trả 400 và không được ghi vào map (`:52,:90`). Việc quét toàn bộ map chạy tối đa 1 lần mỗi phút nhờ CAS trên `lastPrune` (`:63`). Khi map vẫn đầy thì loại 1 mục, chỉ duyệt tối đa 8 mục (`:64-71`), nên chi phí mỗi request là O(1). `values().removeIf` của CHM chỉ xóa khi value vẫn khớp, nên không xóa nhầm mục vừa được `compute` lại. Test `:212-230`. Giới hạn ở đây là giới hạn mềm: bước kiểm tra size ở `:75` không nguyên tử, nên khi nhiều request chạy song song map có thể vượt 10.000 một ít. Tôi chưa đo mức vượt nên không tính là lỗi. |
| N3 (test dùng chung context và tài khoản seed) | **Fixed** | Các test HTTP chỉ dùng email ngẫu nhiên không tồn tại (`ErrorHandlingAndLoginLimitTest.java:61-63`). Các test cần mật khẩu đúng chạy trên một `AuthService` riêng với repo mock (`:79-90`). `Clock` đã được inject (`AuthService.java:29-31`) và nhánh hết cửa sổ được test (`:196-210`, kiểm tra cả biên 14:59 và 15:00). Wiring Spring đúng: `@Autowired` đặt trên constructor 2 tham số, constructor 3 tham số chỉ dùng trong test. Spring context vẫn khởi động bình thường (25 test pass). |
| N4 (MentorPortalTest không chứng minh cô lập dữ liệu) | **Fixed** | `MentorPortalTest.java:106-155`: admin tạo mentor B và intern B. Test assert danh sách intern/task/report của mentor A không chứa dữ liệu của B và ngược lại, gọi chéo `GET /api/interns/{id}` trả 403, và A giao task cho intern của B bị 403. Nếu bỏ bộ lọc ở `InternController:19` thì test này sẽ fail ở `:129`/`:130`. |

## Phát hiện mới

### N5 [Medium]: Kẻ tấn công có thể ép loại mục đang bị khóa để reset lockout của một email
- **Vị trí:** `AuthService.java:65-71`. Ban đầu `victim` được gán bằng mục đầu tiên trong thứ tự duyệt của CHM. Nếu cả 8 mục đầu đều đang bị khóa, mục đầu tiên đó sẽ bị loại, tức là loại một mục đang khóa.
- **Kịch bản:** Kẻ tấn công chưa đăng nhập gửi 5 lần sai cho mỗi email trong khoảng 10.000 email giả. Email giả không chạy BCrypt nên mỗi request rất rẻ. Kết quả là map đầy các mục đang khóa, nên không còn mục chưa khóa nào để ưu tiên loại. Sau đó, mỗi email mới gửi vào sẽ loại mục đầu tiên trong thứ tự duyệt. Lặp lại đủ số lần thì mục `admin@gmail.com` bị loại, bộ đếm của admin về 0 và kẻ tấn công có thêm 5 lần đoán.
- **Mô phỏng** (copy nguyên logic `:59-82`, đồng hồ đứng yên trong một cửa sổ): 50.001 request để làm đầy map, sau đó thêm 253.165 request. Kết quả: lockout của target bị reset 20 lần, target bị đoán **105 lần** trong một cửa sổ 15 phút thay vì 5. Khoảng 300k request trong 15 phút tương đương khoảng 330 req/s, làm được trong LAN. Test `trackedEmailsStayBoundedAndLockedEntriesSurviveAFlood` chỉ flood bằng các mục chưa khóa, nên không phát hiện được trường hợp này. Tên test cũng hứa nhiều hơn những gì nó chứng minh.
- **Cách sửa** (mọi phương án đều phải chọn đánh đổi, nên cần lead hoặc user quyết):
  1. Không bao giờ loại mục đang khóa. Khi không còn mục chưa khóa nào, trả 429 cho email *mới* cho tới lần prune kế tiếp (fail-closed). Lockout giữ nguyên tác dụng, nhưng kẻ tấn công bỏ ra khoảng 50k request rẻ là chặn được đăng nhập của những người chưa có trong map, tối đa 15 phút.
  2. Giữ cách hiện tại, tăng `MAX_TRACKED_EMAILS` lên khoảng 100k. Mỗi mục tối đa khoảng 700 B, tổng khoảng 70 MB. Chi phí tấn công tăng khoảng 10 lần, nhưng lỗi vẫn còn. Ngoài ra cần sửa comment ở `:46-49` và tên test cho đúng ("bị reset dưới flood các mục đã khóa").
  3. Ghi nhận đây là rủi ro tồn dư trong comment và docs, chấp nhận vì là dự án học tập trong LAN.

### N6 [Medium]: Biến thể email có dấu hoặc full-width vượt qua lockout khi chạy MySQL
- **Vị trí:** `AuthService.java:89,91-92`. Key lockout là chuỗi đầu vào sau khi trim và lowercase, nhưng `findByEmail(key)` lại so sánh theo collation của DB. `app/database/schema.sql:1` dùng `utf8mb4_unicode_ci`, còn mặc định của MySQL 8 là `utf8mb4_0900_ai_ci`. Cả hai collation đều không phân biệt dấu (theo tài liệu MySQL, `'a' = 'á'`). Phần tạo email ở `AdminController:17` và `InternController:30` chấp nhận mọi ký tự không phải khoảng trắng.
- **Kịch bản:** Sau 5 lần sai, `admin@gmail.com` bị khóa. Kẻ tấn công chuyển sang `ádmin@gmail.com`, `àdmin@gmail.com`, `admín@gmail.com`, ... Mỗi biến thể là một key mới nên có thêm 5 lần đoán, và MySQL vẫn trả về đúng user admin nên BCrypt chạy trên mật khẩu thật. Số tổ hợp dấu trên các chữ của email rất lớn, nên lockout theo email gần như không còn tác dụng. Profile demo dùng H2 phân biệt hoa thường và dấu nên không bị ảnh hưởng. Lỗi này đã có từ commit `7f50715`, không phải do diff này gây ra, nhưng nó làm sai cam kết "tối đa 5 lần kiểm tra mật khẩu" ở `:43-44` và `04-api-contract.md:60`. Tôi chưa chạy trên MySQL thật. Kết luận dựa trên collation được khai báo trong repo và hành vi collation đã có trong tài liệu MySQL.
- **Cách sửa:** Gọi `findByEmail` trước `reserveAttempt` (chưa chạy BCrypt nên N1 vẫn giữ nguyên). Khi tìm thấy user, dùng `u.getEmail()` (email gốc lưu trong DB) làm key; khi không tìm thấy thì dùng chuỗi đầu vào. Thêm một test với repo mock trả về cùng một user cho hai chuỗi khác nhau.

### Ghi chú (không tính là lỗi)
- Comment mới ở `AuthService.java:41-42` đã thừa nhận đúng việc dò email qua thời gian phản hồi (L3), không còn mâu thuẫn như trước. L3 vẫn mở.
- `AuthService.java:94`: đăng nhập đúng nhưng sai portal (403) vẫn xóa bộ đếm. Điều này hợp lý vì mật khẩu đã đúng.
- Một lần đăng nhập đúng xóa toàn bộ bộ đếm, kể cả các lần thử song song đã giữ chỗ trước đó. Đây là hành vi theo thiết kế và docs đã nêu.
- Độ ổn định của test: `concurrently` dùng pool riêng, `get` có timeout 60 giây và `shutdownNow` trong `finally`. `MutableClock` dùng `volatile`. Không thấy nguy cơ test chập chờn. `trackedEmails` đọc field private qua reflection theo tên `loginAttempts`, nên đổi tên field sẽ làm test lỗi. Chấp nhận được.

## Số lỗi toàn codebase theo mức độ

Trước đây là 0/1/9/15 (Critical/High/Medium/Low).

| Mức độ | Trước | Thay đổi | Sau |
|--------|-------|---------|-----|
| Critical | 0 | | **0** |
| High | 1 | (H1 vẫn mở, rủi ro seed đã được chấp nhận) | **1** |
| Medium | 9 | −N1, −N2, +N5, +N6 | **9** |
| Low | 15 | −N3, −N4 | **13** |

Kết quả: **0/1/9/13**.

## Kết luận

**Sẵn sàng commit: Có.** So với HEAD, diff này giảm rủi ro thật: N1-N4 đã được đóng, test pass, không có lỗi mới mức High hoặc Critical. N5 là đánh đổi mà diff này tạo ra: trước đây map không có giới hạn, còn bây giờ có thể ép reset lockout bằng flood. N6 là lỗi đã có từ trước. Nên xử lý N6 (sửa nhỏ, có thể làm ngay) và chọn một phương án cho N5 trước khi triển khai trên MySQL.

## Câu hỏi còn mở
- N5: chọn fail-closed cho email mới khi map đầy mục đã khóa (đánh đổi là DoS đăng nhập), tăng giới hạn, hay chấp nhận rủi ro và ghi vào docs?
- Môi trường triển khai thật có dùng MySQL với `schema.sql` không? Nếu chỉ chạy demo H2 thì N6 không xảy ra trên thực tế.
