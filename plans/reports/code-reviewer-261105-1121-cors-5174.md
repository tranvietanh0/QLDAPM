# Code review: thêm origin 5174 vào CORS mặc định

Ngày: 2026-11-05 | Phạm vi: `git diff` của 2 file (bỏ qua các file untracked)

## Kết luận

**Chấp nhận (DONE_WITH_CONCERNS nhẹ).** Thay đổi đúng, tối thiểu, nhất quán giữa hai file và giải quyết được nguyên nhân 403. Không có lỗi chặn. Hai điều còn lo: chưa có test tự động nào khóa hành vi CORS, và trong mã nguồn của repo không có chỗ nào ghi lại quy ước "cổng Admin chạy dev ở 5174".

## Phạm vi

- `app/backend/src/main/resources/application.properties:14`: giá trị mặc định của `app.cors.origins` có thêm `http://localhost:5174,http://127.0.0.1:5174`.
- `app/backend/.env.example:7`: dòng chú thích `CORS_ORIGINS` được thêm đúng hai origin đó.
- Không sửa mã Java. Hai origin 5173 vẫn còn nguyên và vẫn đứng đầu danh sách.

## Kiểm chứng

1. **Định dạng giá trị khớp với cách parse.** `CorsConfig.java:8` dùng `origins.split(",")` và không trim. Diff không có khoảng trắng quanh dấu phẩy. Kiểm bằng `cat -A`: không có khoảng trắng thừa. Cuối dòng properties vẫn không có newline giống trước (chỉ là chuyện style, không ảnh hưởng parse).
2. **Nguyên nhân 403 khớp với cách sửa.**
   - `vite.config.js:12` dùng `changeOrigin: true`. Tùy chọn này chỉ đổi header `Host`, còn header `Origin: http://localhost:5174` của trình duyệt vẫn được chuyển tiếp sang Spring.
   - Trình duyệt chỉ gửi `Origin` cho POST/PUT (với GET cùng origin thì không gửi). Vì vậy `DefaultCorsProcessor` của Spring từ chối POST/PUT với 403, còn GET vẫn chạy.
   - Bản desktop không bị lỗi vì `app/desktop/main.cjs:30` xóa header `origin` trước khi chuyển tiếp.
   - `src/record_demo_video.mjs:147-150` (file untracked) mô tả đúng nguyên nhân này và dùng cách lách là xóa Origin.
3. **Không có lớp nào khác can thiệp.** Grep không tìm thấy `spring-boot-starter-security`, `SecurityFilterChain` hay interceptor nào trong `app/backend`. `CorsConfig` là điểm kiểm soát CORS duy nhất.
   - `allowedMethods` đã gồm POST/PUT/DELETE/OPTIONS.
   - `allowedHeaders` gồm `Authorization` và `Content-Type`, đủ cho `api.js`.
4. **Không có biến môi trường nào ghi đè trong repo.** `docker-compose.yml` và các file `.bat` không đặt `CORS_ORIGINS`, nên giá trị mặc định mới sẽ có hiệu lực. Nếu máy dev đã tự đặt `CORS_ORIGINS` (dạng cũ, chỉ có 5173) thì thay đổi này **không** có tác dụng. Xem câu hỏi mở.
5. **Bằng chứng runtime:** tester báo 26 test pass. Tuy nhiên không test nào chạm tới CORS, nên kết quả đó chỉ cho thấy không có hồi quy, chưa chứng minh được bản sửa.

## Phát hiện

### Critical / High
Không có.

### Medium
- **M1. Thiếu test hồi quy cho CORS.** Repo đã có sẵn hạ tầng MockMvc (`ApiIntegrationTest.java`, `AdminInternFlowTest.java`…), nên viết test rẻ. Đề xuất một test gồm ba trường hợp:
  - Preflight `OPTIONS /api/auth/login` với `Origin: http://localhost:5174` và `Access-Control-Request-Method: POST`: kỳ vọng 200 và có `Access-Control-Allow-Origin: http://localhost:5174`.
  - Cùng request đó nhưng với `Origin: http://evil.example`: kỳ vọng 403.
  - Kiểm tra lại 5173 để chắc rằng không bị hồi quy.
  Nếu thiếu test này, một lần sửa sau (ví dụ thêm dấu cách sau dấu phẩy) có thể làm hỏng âm thầm, vì `split` không trim.

### Low
- **L1. Quy ước cổng 5174 chưa được ghi lại trong repo.**
  - `vite.config.js:7-8` cố định `port: 5173, strictPort: true`.
  - Cổng Admin 5174 chỉ tồn tại khi chạy `VITE_PORTAL=admin npx vite --port 5174`, và lệnh này chỉ xuất hiện trong file untracked `src/build_agent_report.py:770`.
  - `app/README.md` và `app/docs/07-server-client-guide.md` chỉ nhắc tới 5173.
  Đề xuất: thêm một dòng vào `app/README.md` mô tả cách chạy cổng Admin dev ở 5174.
- **L2. Origin dev nằm trong giá trị mặc định dùng cho production.** Nếu deploy mà không đặt `CORS_ORIGINS`, server sẽ chấp nhận các origin localhost. Rủi ro thấp vì:
  - chỉ là loopback;
  - không có wildcard;
  - không bật `allowCredentials`;
  - xác thực bằng Bearer header, không dùng cookie.
  Đây cũng là pattern đã có từ trước với 5173, nên không phải rủi ro mới. Ghi lại để biết.
- **L3. Giá trị fallback trong `CorsConfig.java:7` (`http://localhost:5173`) lệch với properties.** Không gây lỗi, vì giá trị trong properties luôn được ưu tiên, và việc không sửa Java là đúng phạm vi. Chỉ ghi nhận.

## Bảo mật
Thay đổi chỉ thêm hai origin loopback cụ thể, không có wildcard hay pattern và không mở rộng method/header. Không có bí mật nào trong diff. Đánh giá: chấp nhận được.

## Đề xuất (theo thứ tự ưu tiên)
1. Thêm test MockMvc cho preflight CORS như mô tả ở M1.
2. Ghi lại lệnh chạy cổng Admin dev 5174 trong `app/README.md` (L1).
3. Sau khi merge bản sửa backend, có thể bỏ phần lách xóa Origin trong `src/record_demo_video.mjs:147-155`, nếu script đó được giữ lại.

## Câu hỏi mở
- Máy dev hoặc máy demo có đang đặt biến môi trường `CORS_ORIGINS` (hoặc có file `.env` thật được nạp) không? Nếu có, cần cập nhật cả ở đó, nếu không 403 vẫn còn.
- Các script `src/*.mjs` và `src/build_agent_report.py` có được commit không? Hiện chúng là nơi duy nhất ghi lại quy ước 5174.
