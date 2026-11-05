# Báo cáo hồi quy sau các thay đổi: ứng dụng IMS

- Ngày: 2026-11-05, 10:24 (Asia/Bangkok)
- So sánh với: `plans/reports/tester-261105-1002-ims-test-report.md` (baseline sáng nay)
- Phạm vi: backend Spring Boot (`app/backend`), frontend Vite/React (`app/frontend`), API live `http://127.0.0.1:8081` (MySQL), cổng 5173 (intern) và 5174 (admin)
- Không sửa mã nguồn hay file test nào. Chỉ có build output (`app/backend/target/`, `app/frontend/dist/`) và file báo cáo này được tạo.

## Kết luận

Mọi kiểm tra đã chạy đều đạt. Backend 19/19 test pass, frontend build thành công, smoke live 73/73 pass. Hai lỗi cũ E01 (đường dẫn không tồn tại) và E04 (sai method) đã sửa: server trả 404 và 405 đúng. Lockout 429 hoạt động trên server live. Không tìm thấy lỗi chặn (blocker) mới. Có ba rủi ro mới cần xem (mục 7). Chưa đo được độ phủ JaCoCo vì hook bảo vệ đọc file đã chặn đường dẫn có chữ "target".

Trạng thái: DONE_WITH_CONCERNS.

## 1. So sánh trước và sau

| Hạng mục | Baseline sáng (10:02) | Hiện tại (10:24) | Nhận xét |
|---|---|---|---|
| Backend test | 3/3 pass (2 lớp) | 19/19 pass (5 lớp), BUILD SUCCESS | Tăng 16 test |
| Độ phủ JaCoCo | Không cấu hình | Đã cấu hình, báo cáo tạo ra; không đọc được số liệu | Xem mục 7 |
| Frontend build | Thành công, 1.43 s, JS 214.28 kB | Thành công, 1.24 s, JS 214.45 kB, không cảnh báo | Chênh lệch 0.17 kB |
| Smoke live | 53/55 (96.4%) | 73/73 (100%) | Bộ kiểm tra mở rộng, có thêm đăng nhập, lockout và 2 kiểm tra cũ |
| E01: `GET /api/does-not-exist` | FAIL, 500 | PASS, 404 | Đã sửa |
| E04: `GET /api/admin/departments` | FAIL, 500 | PASS, 405, có header `Allow: POST` | Đã sửa |
| Khóa 429 sau 5 lần sai | Không có | PASS, lần thứ 6 trả 429 | Mới |
| Mentor đăng nhập cổng admin | Không kiểm tra trong baseline | PASS, 200 | Mới |
| Intern đăng nhập cổng admin | 403 (L02) | PASS, 403 | Giữ nguyên |
| Mentor đăng nhập cổng intern | Không kiểm tra trong baseline | PASS, 403 | Mới |

Lưu ý khi so sánh: baseline gồm 55 kiểm tra, còn bộ hiện tại có 73 kiểm tra. Hai bộ không hoàn toàn trùng nhau, nên tỷ lệ pass chỉ là chỉ báo. Các kiểm tra baseline H01 và H02 đã được chạy lại riêng và đều pass.

## 2. Backend: `mvn verify`

Kết quả: BUILD SUCCESS, 19 test, 0 failure, 0 error, 0 skipped, tổng thời gian 29.264 s.

| Lớp kiểm thử | Test | Pass | Fail | Lỗi | Thời gian | Baseline (thời gian) |
|---|---|---|---|---|---|---|
| `AdminInternFlowTest` | 1 | 1 | 0 | 0 | 15.04 s | 7.63 s |
| `ApiIntegrationTest` | 2 | 2 | 0 | 0 | 1.656 s | 1.501 s |
| `BusinessRuleTest` | 8 | 8 | 0 | 0 | 4.036 s | Chưa có |
| `ErrorHandlingAndLoginLimitTest` | 5 | 5 | 0 | 0 | 0.759 s | Chưa có |
| `MentorPortalTest` | 3 | 3 | 0 | 0 | 1.574 s | Chưa có |
| Tổng | 19 | 19 | 0 | 0 | | |

- Thời gian của `AdminInternFlowTest` tăng từ 7.63 s lên 15.04 s. Đây chỉ là một lần chạy, nên chưa xác định được nguyên nhân (có thể do khởi động JVM và nạp context). Không phải lỗi, nhưng nên theo dõi.
- Log không có `[WARNING]` hay `ERROR` của Maven. Test chạy trên JDK 17 với `-Djava.version=17`, như yêu cầu.

## 3. Frontend: `npm run build`

Kết quả: thành công trong 1.24 s, 36 module. Không có cảnh báo. Kích thước: `index.html` 0.36 kB, CSS 20.65 kB, JS 214.45 kB (gzip 67.05 kB). Frontend không có test, lint hay typecheck nên build là kiểm tra duy nhất.

## 4. Smoke live (tóm tắt)

| Nhóm | Số kiểm tra | Pass | Fail |
|---|---|---|---|
| Health và root | 2 | 2 | 0 |
| Đăng nhập (ba endpoint, đúng mật khẩu) | 9 | 9 | 0 |
| Lockout trên email giả | 7 | 7 | 0 |
| Không token (A) và token sai (T) | 13 | 13 | 0 |
| Lỗi (E) | 4 | 4 | 0 |
| Ma trận vai trò (R01 đến R12, 3 vai trò) | 36 | 36 | 0 |
| Frontend 5173 và 5174 | 2 | 2 | 0 |
| Tổng | 73 | 73 | 0 |

## 5. Bảng kiểm tra API đầy đủ

Vai trò: ADMIN là `admin@gmail.com`, MENTOR là `mentor@gmail.com`, INTERN là `intern@gmail.com`. Cột "Thực tế" là mã HTTP đọc từ server live.

### 5.1 Health, đăng nhập, khóa đăng nhập

| ID | Endpoint | Vai trò | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|---|
| H01 | `GET /api/health` | Công khai | 200 | 200 | PASS |
| H02 | `GET /` | Công khai | 200 | 200 | PASS |
| L-ADM-GEN | `POST /api/auth/login` | ADMIN | 200 | 200 | PASS |
| L-MEN-GEN | `POST /api/auth/login` | MENTOR | 200 | 200 | PASS |
| L-INT-GEN | `POST /api/auth/login` | INTERN | 200 | 200 | PASS |
| P-ADM-ADMIN | `POST /api/auth/admin/login` | ADMIN | 200 | 200 | PASS |
| P-MEN-ADMIN | `POST /api/auth/admin/login` | MENTOR | 200 | 200 | PASS |
| P-INT-ADMIN | `POST /api/auth/admin/login` | INTERN | 403 | 403 | PASS |
| P-INT-INTERN | `POST /api/auth/intern/login` | INTERN | 200 | 200 | PASS |
| P-MEN-INTERN | `POST /api/auth/intern/login` | MENTOR | 403 | 403 | PASS |
| P-ADM-INTERN | `POST /api/auth/intern/login` | ADMIN | 403 | 403 | PASS |
| LOCK-1 đến LOCK-5 | `POST /api/auth/login`, email `lockcheck-<ngẫu nhiên>@example.com`, sai mật khẩu | Không có | 401 mỗi lần | 401 mỗi lần | PASS (5 dòng) |
| LOCK-6 | Cùng email, lần thứ 6 | Không có | 429 | 429 | PASS |
| LOCK-7 | Cùng email, lần thứ 7 | Không có | 429 | 429 | PASS |

Nội dung thông báo 429: "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút".

### 5.2 Không token và token sai

| ID | Endpoint | Vai trò | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|---|
| A-01 | `GET /api/auth/me` | Không có | 401 | 401 | PASS |
| A-02 | `GET /api/dashboard/statistics` | Không có | 401 | 401 | PASS |
| A-03 | `GET /api/mentors` | Không có | 401 | 401 | PASS |
| A-04 | `GET /api/departments` | Không có | 401 | 401 | PASS |
| A-05 | `GET /api/interns` | Không có | 401 | 401 | PASS |
| A-06 | `GET /api/interns/1` | Không có | 401 | 401 | PASS |
| A-07 | `GET /api/tasks` | Không có | 401 | 401 | PASS |
| A-08 | `GET /api/tasks/my-tasks` | Không có | 401 | 401 | PASS |
| A-09 | `GET /api/reports` | Không có | 401 | 401 | PASS |
| A-10 | `GET /api/evaluations` | Không có | 401 | 401 | PASS |
| A-11 | `GET /api/evaluations/1` | Không có | 401 | 401 | PASS |
| T01 | `GET /api/interns` | Token sai | 401 | 401 | PASS |
| T02 | `GET /api/interns` | Header `Basic` thay vì `Bearer` | 401 | 401 | PASS |

### 5.3 Lỗi (hai kiểm tra đã từng FAIL)

| ID | Endpoint | Vai trò | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|---|
| E02 | `GET /api/interns/abc` | ADMIN | 400 | 400 | PASS |
| E03 | `GET /api/interns/999999` | ADMIN | 404 | 404 | PASS |
| E01 | `GET /api/does-not-exist` | ADMIN | 404 | 404 | PASS (trước đó 500) |
| E04 | `GET /api/admin/departments` | ADMIN | 405 | 405, `Allow: POST` | PASS (trước đó 500) |

Thông báo của E01 là "Không tìm thấy đường dẫn yêu cầu". Thông báo của E04 là "Phương thức không được hỗ trợ cho đường dẫn này".

### 5.4 Ma trận vai trò trên GET

| ID | Endpoint | Vai trò | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|---|
| R01 | `GET /api/auth/me` | ADMIN | 200 | 200 | PASS |
| R01 | `GET /api/auth/me` | MENTOR | 200 | 200 | PASS |
| R01 | `GET /api/auth/me` | INTERN | 200 | 200 | PASS |
| R02 | `GET /api/dashboard/statistics` | ADMIN | 200 | 200 | PASS |
| R02 | `GET /api/dashboard/statistics` | MENTOR | 200 | 200 | PASS |
| R02 | `GET /api/dashboard/statistics` | INTERN | 200 | 200 | PASS |
| R03 | `GET /api/mentors` | ADMIN | 200 | 200 | PASS |
| R03 | `GET /api/mentors` | MENTOR | 200 | 200 | PASS |
| R03 | `GET /api/mentors` | INTERN | 200 | 200 | PASS |
| R04 | `GET /api/departments` | ADMIN | 200 | 200 | PASS |
| R04 | `GET /api/departments` | MENTOR | 200 | 200 | PASS |
| R04 | `GET /api/departments` | INTERN | 200 | 200 | PASS |
| R05 | `GET /api/interns` | ADMIN | 200 | 200 | PASS |
| R05 | `GET /api/interns` | MENTOR | 200 | 200 | PASS |
| R05 | `GET /api/interns` | INTERN | 200 | 200 | PASS |
| R06 | `GET /api/tasks` | ADMIN | 200 | 200 | PASS |
| R06 | `GET /api/tasks` | MENTOR | 200 | 200 | PASS |
| R06 | `GET /api/tasks` | INTERN | 200 | 200 | PASS |
| R07 | `GET /api/reports` | ADMIN | 200 | 200 | PASS |
| R07 | `GET /api/reports` | MENTOR | 200 | 200 | PASS |
| R07 | `GET /api/reports` | INTERN | 200 | 200 | PASS |
| R08 | `GET /api/evaluations` | ADMIN | 200 | 200 | PASS |
| R08 | `GET /api/evaluations` | MENTOR | 200 | 200 | PASS |
| R08 | `GET /api/evaluations` | INTERN | 200 | 200 | PASS |
| R09 | `GET /api/tasks/my-tasks` | ADMIN | 403 | 403 | PASS |
| R09 | `GET /api/tasks/my-tasks` | MENTOR | 403 | 403 | PASS |
| R09 | `GET /api/tasks/my-tasks` | INTERN | 200 | 200 | PASS |
| R10 | `GET /api/interns/1` | ADMIN | 200 | 200 | PASS |
| R10 | `GET /api/interns/1` | MENTOR | 200 | 200 | PASS |
| R10 | `GET /api/interns/1` | INTERN | 200 | 200 | PASS |
| R11 | `GET /api/interns/999999` | ADMIN | 404 | 404 | PASS |
| R11 | `GET /api/interns/999999` | MENTOR | 404 | 404 | PASS |
| R11 | `GET /api/interns/999999` | INTERN | 404 | 404 | PASS |
| R12 | `GET /api/evaluations/1` | ADMIN | 404 | 404 | PASS |
| R12 | `GET /api/evaluations/1` | MENTOR | 404 | 404 | PASS |
| R12 | `GET /api/evaluations/1` | INTERN | 404 | 404 | PASS |

Lưu ý R12: dữ liệu live chưa có đánh giá nào, nên nhánh 200 không được kiểm chứng trên dữ liệu thật.

### 5.5 Frontend

| ID | URL | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|
| FE-1 | `http://127.0.0.1:5173/` (intern) | 200 | 200 | PASS |
| FE-2 | `http://127.0.0.1:5174/` (admin) | 200 | 200 | PASS |

## 6. Phạm vi kiểm tra phân quyền mentor

Dữ liệu live chỉ có một thực tập sinh (id 1, mentor là `mentor@gmail.com`), không có task, báo cáo hay đánh giá nào trong danh sách đọc. Vì vậy trên live, danh sách của ADMIN và MENTOR giống hệt nhau và không chứng minh được việc lọc theo mentor.

Việc lọc được kiểm chứng như sau:
- Đọc mã: `InternController.list` dùng `findByMentorId` cho MENTOR. `TaskController.list`, `ReportController.list` và `EvaluationController.list` cũng lọc theo mentor hoặc theo intern.
- Test H2: `AdminInternFlowTest` (các dòng 67 và 75 đến 77) kiểm tra mentor cũ và mentor không sở hữu bị 403. `BusinessRuleTest` dòng 174 kiểm tra `GET /api/evaluations/{internId}` với mentor không sở hữu bị 403.

Không tạo dữ liệu mới trên live để kiểm chứng, vì ràng buộc chỉ cho phép đăng nhập.

## 7. Defect mới và rủi ro

Không có lỗi chặn mới. Các mục dưới đây được phát hiện bằng đọc mã, trừ khi có ghi chú khác.

1. **Mức trung bình: giới hạn `MAX_TRACKED_EMAILS` không được thực thi.** Trong `AuthService.recordFailure` (`app/backend/src/main/java/com/example/internms/service/AuthService.java`), khi số mục đạt 10.000, mã chỉ xóa các mục đã hết hạn rồi vẫn thêm mục mới. Nếu mọi mục còn trong cửa sổ 15 phút, bản đồ `failedLogins` vẫn tăng không giới hạn. Một client có thể gửi nhiều email ngẫu nhiên để tăng bộ nhớ. Chưa tái hiện trên live. Không có test nào cho nhánh này. Đề xuất: khi vượt ngưỡng thì không ghi thêm hoặc loại mục cũ nhất, kèm test.

2. **Thiết kế, cần người dùng quyết định: khóa theo email, không theo IP.** Năm lần sai liên tiếp cho `admin@gmail.com` từ bất kỳ đâu sẽ khóa tài khoản demo trong 15 phút. Kiểm tra khóa chạy trước kiểm tra mật khẩu (`rejectIfLocked` trước `encoder.matches`), nên trong thời gian khóa, cả mật khẩu đúng cũng bị 429. Đây là đúng quyết định đã nêu trong yêu cầu, nên không coi là lỗi. Trade-off cần ghi nhận: bất kỳ ai cũng có thể khóa tạm tài khoản demo. Không thử điều này trên tài khoản demo vì ràng buộc cấm gửi mật khẩu sai.

3. **Khóa đăng nhập không tồn tại sau khi restart.** Bộ đếm nằm trong bộ nhớ, như đã ghi trong comment của `AuthService`. Đây là giới hạn đã biết, không phải lỗi.

4. **Không có test cho nhánh catch-all 500 của `ApiExceptionHandler`.** Nhánh này ghi log và trả "Lỗi máy chủ". Nên thêm một test ép ngoại lệ để khóa hành vi.

5. **Các kiểm tra không chạy được trên live do ràng buộc ghi.** Kiểm tra 415 (Content-Type sai) và JSON sai định dạng không chạy trên live vì sẽ là POST ngoài danh sách cho phép. Kiểm tra 415 có test trong `ErrorHandlingAndLoginLimitTest` (`unsupportedMediaTypeReturns415`). Với JSON sai định dạng, chưa xác minh được test nào bao phủ nhánh này.

6. **Độ phủ JaCoCo chưa đọc được.** Hook `scout-block` chặn đọc `app/backend/target/site/jacoco/jacoco.csv` vì đường dẫn có chữ "target". Đây là hook đã được cấu hình và tôi không sửa cấu hình hay lách nó. Báo cáo HTML/CSV vẫn được tạo ra bởi `mvn verify`. Để đọc số liệu, cần thêm `!target` vào `.claude/.ckignore` hoặc mở file thủ công.

## 8. Lệnh đã chạy

Tất cả lệnh chạy từ thư mục gốc của dự án, trừ khi ghi rõ.

```bash
# 1. Backend: build, test và JaCoCo
cd app/backend && ~/.m2/wrapper/dists/apache-maven-3.9.9/3477a4f1/bin/mvn -B -Djava.version=17 verify

# 2. Frontend: build production
cd app/frontend && npm run build

# 3. Smoke live: đăng nhập demo, lockout trên email giả, GET theo vai trò, frontend
bash C:/Users/tranv/AppData/Local/Temp/claude/c16b8cdaf0373962/44d36a7c-96d6-4d7c-9ac8-a6830f79c0ae/scratchpad/regression-smoke.sh

# 4. Health và root (chạy riêng, bổ sung cho H01 và H02)
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/api/health
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/
```

Script smoke dùng `curl` và `node` để đọc JSON (Python không khả dụng trên máy). Kết quả từng dòng nằm ở `C:/Users/tranv/AppData/Local/Temp/claude/c16b8cdaf0373962/44d36a7c-96d6-4d7c-9ac8-a6830f79c0ae/scratchpad/smoke-out/results.tsv`, còn các body JSON của danh sách nằm cùng thư mục.

Các yêu cầu ghi duy nhất được gửi lên live: 9 lần đăng nhập đúng mật khẩu bằng ba tài khoản demo (6 lần tạo phiên mới, 3 lần trả 403 không tạo phiên) và 7 lần đăng nhập sai với email giả `lockcheck-*@example.com` (không ghi DB, chỉ cập nhật bộ đếm trong bộ nhớ). Ba phiên của lần smoke này hết hạn sau 12 giờ, theo cấu hình hiện có.

Không có POST, PUT hay DELETE nào khác được gửi.

## 9. Đối chiếu với các mục của baseline

- E01 và E04: đã sửa, xem mục 1.
- L01 (đăng nhập sai mật khẩu, 401): baseline dùng email demo. Lần này thay bằng email giả trong chuỗi lockout (LOCK-1, 401), để không gửi mật khẩu sai cho tài khoản demo.
- L02 (intern qua cổng admin, 403): PASS, P-INT-ADMIN.
- R09 (`my-tasks`): PASS, ADMIN và MENTOR đều 403.
- R12 (`evaluations/1`): PASS, vẫn 404 vì chưa có đánh giá.
- Kiểm tra "intern gọi GET admin-only": baseline đã ghi là không có GET nào giới hạn ADMIN. Lần này không làm lại.

## 10. Câu hỏi còn mở

1. Có muốn đổi khóa theo email thành kết hợp email và IP, hoặc giữ nguyên như yêu cầu? Đây là quyết định sản phẩm.
2. Có sửa giới hạn `MAX_TRACKED_EMAILS` (mục 7.1) trong lượt này không? Báo cáo không sửa mã nguồn.
3. Có cho phép thêm `!target` vào `.claude/.ckignore` để đọc số liệu JaCoCo không? Hoặc người dùng tự mở báo cáo HTML?
4. Có cần dữ liệu thử nghiệm trên live (ví dụ thêm một thực tập sinh thứ hai thuộc mentor khác) để kiểm chứng việc lọc theo mentor ngoài H2? Việc này là ghi dữ liệu, nên chưa làm.
5. Thời gian `AdminInternFlowTest` tăng gần gấp đôi so với sáng. Có cần chạy lại vài lần để xác định đây có phải nhiễu không?
