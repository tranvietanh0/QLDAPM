# 5. Tester - Test Plan & Test Cases

## Test strategy
- Smoke test: login, dashboard, API health.
- Functional test: intern/task/report/evaluation.
- Permission test: role access.
- Negative test: invalid dates, invalid status, duplicate email.
- Regression: chay lai luong demo sau moi lan fix bug.

## Test cases
| ID | Scenario | Expected |
|---|---|---|
| TC01 | Login dung | 200, co token va role |
| TC02 | Login sai password | 401 |
| TC03 | Admin tao intern hop le | Tao thanh cong |
| TC04 | Tao intern trung email | Tu choi |
| TC05 | End date <= Start date | Tu choi |
| TC06 | Mentor tao task cho intern minh | Thanh cong, status TODO |
| TC07 | Mentor tao task cho intern khac | 403 |
| TC08 | Deadline task ngoai ky thuc tap | 400 |
| TC09 | Intern TODO -> IN_PROGRESS | Thanh cong |
| TC10 | Intern TODO -> COMPLETED | 400 |
| TC11 | Intern sua task cua nguoi khac | 403 |
| TC12 | Intern nop bao cao tuan | SUBMITTED |
| TC13 | Nop trung week | Tu choi |
| TC14 | Mentor review bao cao | REVIEWED + rating |
| TC15 | Rating ngoai 0..10 | Tu choi |
| TC16 | Mentor danh gia cuoi ky | Overall = average |
| TC17 | Intern xem evaluation cua minh | Thanh cong |
| TC18 | Intern xem evaluation nguoi khac | 403 |

## Mau bug report
- Bug ID: BUG-001
- Title: Intern co the chuyen TODO -> COMPLETED.
- Severity: High.
- Environment: Chrome, localhost.
- Steps: Login Intern -> My Tasks -> chon COMPLETED tu TODO.
- Expected: He thong tu choi.
- Actual: Cap nhat thanh cong.
- Status: Fixed -> Retest -> Closed.


## Cách chạy kiểm thử

1. Trong `backend`: chạy `mvn verify` (cần Maven và dependency; test dùng H2 memory). Lệnh này chạy toàn bộ test trong `src/test/java/com/example/internms/` và tạo báo cáo độ phủ JaCoCo tại `target/site/jacoco/index.html`. Máy chỉ có JDK 17 thì chạy `mvn -Djava.version=17 verify`.
2. Chạy `START_SERVER_DEMO.bat`, sau đó từ thư mục gốc chạy `python scripts/smoke_api.py` để kiểm tra health, login, API đọc, logout.
3. Chạy `START_CLIENT.bat`, đăng nhập với từng vai trò và thực hiện TC01–TC18 trên trình duyệt.
4. Chạy `cd frontend && npm run build` để xác nhận có thể đóng gói giao diện.

## Trang thai test tu dong
- `BusinessRuleTest`: TC04, TC05, TC08, TC10, TC13, TC15, TC18.
- `MentorPortalTest`: Admin / Server nhan ADMIN va MENTOR, tu choi INTERN (403); Client chi nhan INTERN; mentor dang nhap qua Admin / Server giao task, review bao cao va danh gia.
- `ErrorHandlingAndLoginLimitTest`: 404 duong dan khong ton tai, 405 kem header `Allow`, 415, khoa 429 sau 5 lan login sai, login dung xoa bo dem.
- `ApiIntegrationTest`, `AdminInternFlowTest`: luong chinh login, phan quyen, task, bao cao, danh gia (khong anh xa theo tung TC).
- CI: GitHub Actions (`.github/workflows/ci.yml` o goc repo) chay `mvn -B verify` voi JDK 21, tai bao cao JaCoCo len thanh artifact `jacoco-report`, va chay `npm run build` cho frontend.
