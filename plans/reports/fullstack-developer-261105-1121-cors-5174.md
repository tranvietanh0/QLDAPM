# Báo cáo: thêm origin 5174 vào CORS mặc định

## Đã sửa gì

Cổng Admin chạy dev ở `http://localhost:5174` bị HTTP 403 với mọi POST/PUT, vì danh sách CORS mặc định của backend chỉ có cổng 5173. Đã thêm hai origin 5174 vào giá trị mặc định, giữ nguyên hai origin 5173 ở đầu danh sách.

### `app/backend/src/main/resources/application.properties` (dòng 14)

- Trước: `app.cors.origins=${CORS_ORIGINS:http://localhost:5173,http://127.0.0.1:5173}`
- Sau: `app.cors.origins=${CORS_ORIGINS:http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174}`

### `app/backend/.env.example` (dòng 7)

- Trước: `# CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`
- Sau: `# CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174`

## Cách CorsConfig đọc giá trị

`CorsConfig.java` nhận `@Value("${app.cors.origins:http://localhost:5173}")`, rồi gọi `origins.split(",")` cho `allowedOrigins` trên `/api/**`. Lệnh tách này không có trim, nên danh sách phải viết liền, không có khoảng trắng sau dấu phẩy. Giá trị mới tuân theo đúng định dạng đó.

## Kiểm tra

`git diff --stat` chỉ cho thấy hai file trên thay đổi, mỗi file một dòng. Chưa chạy test, vì bước test do agent khác đảm nhận.

## Câu hỏi còn mở

- Nếu máy dev đang đặt biến môi trường `CORS_ORIGINS`, biến đó sẽ ghi đè giá trị mặc định. Khi đó cần tự thêm hai origin 5174 vào biến.
- Giá trị dự phòng trong chính `CorsConfig.java` (`http://localhost:5173`) không được sửa vì file này chỉ đọc. Giá trị này chỉ dùng khi thiếu hẳn thuộc tính `app.cors.origins`.
