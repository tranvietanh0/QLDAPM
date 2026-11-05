> **Hai ứng dụng desktop dùng MySQL XAMPP**
>
> Chạy **npm run sever** để mở **Admin / Server**: Admin và Mentor cùng đăng nhập ở đây (Admin tạo tài khoản thực tập sinh; Mentor giao việc, theo dõi và chấm báo cáo cho thực tập sinh được phân công). Giữ cửa sổ này mở khi thực tập sinh làm việc.
>
> Chạy **npm run client** ở terminal khác để mở **Client thực tập sinh**: đăng nhập tài khoản Admin cấp, nhận việc, cập nhật tiến độ và nộp báo cáo.
>
> Hai lệnh dùng được từ thư mục QLDA hoặc QLDAPM_Client_Server và tự build/mở exe. MySQL XAMPP ở C:\xampp được bật nếu chưa chạy. Xem [hướng dẫn đầy đủ](CHAY_DESKTOP_XAMPP.txt). Các mục H2 bên dưới là demo tùy chọn.

# QLDAPM – Hệ thống quản lý thực tập sinh (Client–Server)

Project đã được nâng cấp từ mã gốc `QLDAPM.zip`. Mô hình triển khai:

```
Admin / Server (.exe)               Intern / Client (.exe)
  - Admin + Mentor đăng nhập          - Đăng nhập tài khoản được cấp
  - Quản lý, cấp tài khoản
  - Giao việc, chấm báo cáo           - Nhận việc, nộp báo cáo
  - Tự khởi động API                         │
             │                               │ HTTP/JSON
             └───────── Spring Boot API ──────┘
                              │ JDBC
                         MySQL XAMPP
```

**Tài khoản demo** (chỉ dùng khi thử nghiệm): `admin@gmail.com`, `mentor@gmail.com`, `intern@gmail.com`; mật khẩu chung: **123456**. Hãy đổi mật khẩu sau khi thử nghiệm. Database khởi tạo tài khoản mẫu chỉ khi bảng người dùng chưa có dữ liệu. Màn hình đăng nhập không hiển thị sẵn email/mật khẩu demo. `admin@gmail.com` và `mentor@gmail.com` đăng nhập ở ứng dụng Admin / Server; `intern@gmail.com` đăng nhập ở Client thực tập sinh.

## 1. Chuẩn bị trên Windows

Cài **JDK 21**, **Maven 3.9+**, **Node.js 20+ / npm**. Nếu chạy MySQL, thêm MySQL 8 hoặc Docker Desktop. Chạy `KIEM_TRA_MOI_TRUONG.bat` để kiểm tra `java`, `mvn`, `node`, `npm`. `pom.xml` khai báo Java 21; nếu máy chỉ có JDK 17, thêm `-Djava.version=17` vào lệnh Maven (ví dụ `mvn -Djava.version=17 verify`).

## 2. Chạy nhanh nhất (không cài MySQL)

1. Giải nén ZIP vào thư mục **không dấu, không ký tự đặc biệt** (ví dụ `D:\QLDAPM`).
2. Chạy `START_SERVER_DEMO.bat`. Lần đầu Maven tải thư viện từ mạng. Khi thấy `Started InternManagementApplication`, Server đã mở cổng **8081**; H2 tạo dữ liệu trong `backend/data/`.
3. Chạy `npm run client:browser` ở **cửa sổ khác** để mở bản web demo.
4. Truy cập `http://localhost:5173` và đăng nhập bằng tài khoản demo.

Hoặc chạy `START_ALL_DEMO.bat` để mở hai terminal riêng. **Không đóng cửa sổ Server khi đang dùng Client.**

## 3. Chạy với MySQL (lưu trữ thật)

1. Tạo CSDL bằng `database/schema.sql` (chỉ lệnh `CREATE DATABASE`); Spring JPA sẽ tự tạo bảng theo entity.
2. Đặt biến môi trường `DB_USER`, `DB_PASSWORD`, `DB_URL` cho kết nối khác mặc định. Ví dụ trong Command Prompt:

   ```bat
   set DB_USER=root
   set DB_PASSWORD=matkhau_mysql_cua_ban
   set DB_URL=jdbc:mysql://127.0.0.1:3306/intern_management?useSSL=false^&allowPublicKeyRetrieval=true^&serverTimezone=Asia/Ho_Chi_Minh
   START_SERVER_MYSQL.bat
   ```

   Nếu dùng Docker Desktop, chạy `docker compose up -d mysql` trong thư mục này. `docker-compose.yml` dùng mật khẩu mẫu `root`, **chỉ dành cho môi trường thử nghiệm**.
3. Chạy `npm run client:browser` cho bản web, hoặc `npm run client` cho ứng dụng thực tập sinh.

`database/schema_full_mysql.sql` là tham khảo cấu trúc bảng / công cụ import thủ công; **không cần** import file này nếu để JPA tạo bảng bằng `ddl-auto=update`.

## 4. Chạy trong IntelliJ / NetBeans / VS Code

- Mở **backend** dưới dạng project Maven, chạy `InternManagementApplication.java`.
- Với H2: thêm JVM/Run argument hoặc biến môi trường `SPRING_PROFILES_ACTIVE=demo`.
- Mở terminal ở **frontend**: `npm install`, sau đó `npm run dev`.
- Kiểm tra Server bằng `http://localhost:8081/api/health`; kết quả `status=UP` là API đã sẵn sàng.
- Frontend tự proxy `/api` sang `http://127.0.0.1:8081`, không cần sửa URL trong từng màn hình.

## 5. Client trên máy khác trong mạng LAN

- Chạy Server ở máy chủ; máy Client mở `http://IP_CUA_MAY_CHU:5173`, Vite proxy sang Spring Boot ở máy chủ.
- Cho phép TCP **5173** và **8081** nếu Windows Firewall chặn.
- Nếu Client chạy **riêng một máy khác**: đặt `API_SERVER=http://IP_SERVER:8081` trước khi chạy Vite; hoặc dùng `VITE_API_URL=http://IP_SERVER:8081/api` và cấu hình `CORS_ORIGINS` chứa địa chỉ frontend.
- Không dùng địa chỉ `localhost` để trỏ tới **máy khác**; `localhost` là máy đang mở trình duyệt.

## 6. Các chức năng & phân quyền

| Chức năng | Admin | Mentor | Intern |
|---|---:|---:|---:|
| Đăng nhập, đăng xuất, đổi mật khẩu | Có | Có | Có |
| Thống kê dashboard | Có | Có | Có |
| Xem hồ sơ thực tập sinh | Tất cả | Được giao | Chính mình |
| Tạo, sửa, xóa hồ sơ thực tập sinh | Có | Không | Không |
| Quản lý phòng ban, người hướng dẫn | Có | Không | Không |
| Xem công việc | Tất cả | Được giao | Của mình |
| Giao, sửa công việc | Có | Được giao | Không |
| Xóa công việc | Có | Được giao | Không |
| Cập nhật trạng thái công việc | Không | Không | Của mình |
| Gửi/sửa báo cáo chưa duyệt | Không | Không | Của mình |
| Chấm báo cáo | Có | Được giao | Không |
| Đánh giá cuối kỳ | Tạo/sửa | Tạo/sửa | Xem |

Hồ sơ có tìm kiếm, lọc trạng thái; tiến độ tính từ số công việc hoàn thành. Khi Admin **chuyển Mentor** cho Intern, công việc và đánh giá cũ cũng được chuyển người phụ trách. Xóa Intern được xử lý cùng dữ liệu công việc/báo cáo/đánh giá liên quan.

## 7. Cấu trúc

```
backend/             Spring Boot API, entity, JPA, xác thực, test
frontend/            React, Vite, CSS giao diện
  src/App.jsx        Màn hình và biểu mẫu
  src/api.js         Gọi API với Bearer token
  src/styles.css     Giao diện responsive
database/            SQL MySQL
postman/             API collection
scripts/             Câu lệnh kiểm tra sơ bộ
docs/                BA, PM, API, test, luồng demo
START_*.bat          Chạy project trên Windows
```

## 8. Lỗi thường gặp

- **`mvn is not recognized`**: cài Maven, thêm `...\apache-maven-...\bin` vào PATH, mở lại Terminal.
- **`java version...`**: chọn đúng JDK 21 (`java -version`), hoặc với JDK 17 thêm `-Djava.version=17` vào lệnh Maven.
- **Đăng nhập bị báo HTTP 403**: tài khoản không thuộc ứng dụng đang mở (Admin/Mentor dùng Admin / Server, Intern dùng Client).
- **Đăng nhập bị báo HTTP 429**: cùng một email đã đăng nhập sai 5 lần trong 15 phút; chờ hết thời gian khóa rồi thử lại.
- **Port 8081 đã được dùng**: thay `SERVER_PORT=8090`, và `API_SERVER=http://127.0.0.1:8090` ở terminal Client.
- **Không kết nối MySQL**: kiểm tra dịch vụ MySQL 3306, `DB_URL`, `DB_USER`, `DB_PASSWORD`; muốn thử ngay hãy dùng `START_SERVER_DEMO.bat`.
- **Client báo lỗi kết nối Server**: kiểm tra Server đang chạy, địa chỉ/cổng 8081, proxy Vite và firewall.
- **Lỗi `npm install`**: bảo đảm Node.js >=20, máy có Internet lần đầu, chạy lại `npm install` trong thư mục `frontend`.
- **Không vào được tài khoản demo**: tài khoản mẫu chỉ được tạo khi bảng `users` trống. Nếu dùng DB cũ, thử tài khoản/mật khẩu đã có; không xóa DB thật để lấy lại mật khẩu.

## 9. Trạng thái kiểm tra & lưu ý bảo mật

Có test Spring MockMvc trong `backend/src/test`. Trong `backend`, `mvn verify` chạy toàn bộ test và tạo báo cáo độ phủ JaCoCo tại `target/site/jacoco/index.html` (chỉ báo cáo, độ phủ thấp không làm build thất bại). GitHub Actions (`.github/workflows/ci.yml` ở gốc repo) chạy `mvn -B verify` với JDK 21 và `npm run build` cho frontend khi push hoặc mở pull request vào `main`. Kiểm thử end-to-end trên giao diện vẫn làm thủ công. Tài liệu kiểm thử nằm tại `docs/05-testing.md`.

Đây là project phục vụ học tập/demo. API tạm khóa một email sau 5 lần đăng nhập sai trong 15 phút (HTTP 429), nhưng bộ đếm chỉ nằm trong bộ nhớ: mất khi khởi động lại và không chia sẻ giữa nhiều server. Trước khi đưa lên Internet cần thay toàn bộ mật khẩu demo, dùng HTTPS, xác thực bảo mật vận hành và công cụ migration CSDL (Flyway/Liquibase). Không đưa file `.env`, dữ liệu H2 hoặc mật khẩu MySQL thật lên Git.
