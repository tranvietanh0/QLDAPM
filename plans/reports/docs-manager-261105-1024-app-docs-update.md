# Cập nhật tài liệu app theo thay đổi hành vi ngày 2026-11-05

Phạm vi: chỉ sửa tài liệu trong `app/`. Không sửa mã nguồn, README gốc, `docs/` gốc. Không commit.

## File đã sửa

| File | Thay đổi |
|---|---|
| `app/README.md` | Banner và sơ đồ: Admin và Mentor cùng đăng nhập ở Admin / Server. Ghi chú màn hình đăng nhập không hiển thị sẵn email/mật khẩu demo, và tài khoản demo nào dùng ở ứng dụng nào. Mục 1: dùng `-Djava.version=17` khi máy chỉ có JDK 17. Mục 8: thêm lỗi 403 (sai ứng dụng) và 429 (khóa đăng nhập). Mục 9: thay đoạn "chưa xác nhận build" bằng `mvn verify`, báo cáo JaCoCo, CI GitHub Actions. Ghi rõ cơ chế khóa đăng nhập đã có nhưng chỉ lưu trong bộ nhớ. |
| `app/docs/02-ba-requirements.md` | Actor: ứng dụng đăng nhập của từng vai trò. US01: 403 khi sai ứng dụng, 429 sau 5 lần sai trong 15 phút, đăng nhập đúng xóa bộ đếm, không hiển thị sẵn thông tin demo. |
| `app/docs/04-api-contract.md` | Thêm `/auth/admin/login` (ADMIN, MENTOR) và `/auth/intern/login` (INTERN). Ví dụ login đổi sang `/auth/admin/login`. Bảng mã lỗi bổ sung 404 đường dẫn, 405 kèm `Allow`, 415, 429, 500 có ghi log. Thêm mô tả giới hạn đăng nhập. |
| `app/docs/05-testing.md` | Bước 1 đổi sang `mvn verify` (kèm JaCoCo, tùy chọn JDK 17). Thay dòng "chưa có bằng chứng chạy kiểm thử" bằng mục trạng thái test tự động: `BusinessRuleTest` ứng với TC04, TC05, TC08, TC10, TC13, TC15, TC18; nội dung của `MentorPortalTest`, `ErrorHandlingAndLoginLimitTest`, các test có sẵn; và CI. |
| `app/docs/07-server-client-guide.md` | Bước 3: Client chỉ nhận INTERN, Admin/Mentor đăng nhập ở Admin / Server. |

## Bằng chứng

- Cổng đăng nhập: `AuthController.java` (`ADMIN_PORTAL`, `INTERN_PORTAL`), `AuthService.login` (403), `portal.js` (`portalRoles`).
- Khóa đăng nhập: `AuthService.java` (`MAX_FAILED_LOGINS=5`, `FAILED_LOGIN_WINDOW=15 phút`, lưu trong bộ nhớ, xóa khi đăng nhập đúng).
- Mã lỗi: `ApiExceptionHandler.java`.
- Màn hình đăng nhập: diff `App.jsx` (bỏ email mặc định và hộp mật khẩu demo).
- JaCoCo: `pom.xml` (goal `report` ở phase `verify`, không có goal `check`). CI: `.github/workflows/ci.yml` (JDK 21, `mvn -B verify`, artifact `jacoco-report`, `npm run build`).
- Ánh xạ TC: `plans/reports/tester-261105-1015-business-rule-tests.md`.

## Câu hỏi còn mở

- Chưa chạy lại `mvn verify` trong lần cập nhật tài liệu này; đường dẫn báo cáo JaCoCo lấy từ cấu hình mặc định và từ CI.
