# Báo cáo: CI (GitHub Actions) + báo cáo độ phủ JaCoCo

Trạng thái: hoàn thành, chưa commit, chưa push.

## Thay đổi

| File | Thay đổi |
|---|---|
| `app/backend/pom.xml` | Tách khối `<build>` thành nhiều dòng; thêm `jacoco-maven-plugin` 0.8.16 (bản mới nhất trên Maven Central) với `prepare-agent` (gắn agent vào Surefire qua `argLine`) và `report` gắn vào phase `verify`. Không có goal `check`, nên độ phủ thấp không làm build thất bại. |
| `.github/workflows/ci.yml` (mới) | Workflow `CI`, chạy khi push và pull_request vào `main`, `permissions: contents: read`, `concurrency` hủy lần chạy cũ trên cùng ref. |

Job `backend` (ubuntu-latest, `working-directory: app/backend`):
- `actions/checkout@v7`, `actions/setup-java@v6` (Temurin 21, `cache: maven`, khóa theo `app/backend/pom.xml`).
- `mvn -B verify` (test dùng H2, không cần dịch vụ DB).
- Bước "Write coverage summary" (`if: always()`): dùng awk đọc `target/site/jacoco/jacoco.csv`, ghi bảng độ phủ dòng và nhánh vào `$GITHUB_STEP_SUMMARY`. Nếu thiếu CSV thì ghi cảnh báo, bước này không thất bại.
- `actions/upload-artifact@v7` tải thư mục HTML `app/backend/target/site/jacoco/` lên, tên artifact `jacoco-report`.

Job `frontend` (ubuntu-latest, `working-directory: app/frontend`):
- `actions/checkout@v7`, `actions/setup-node@v7` (Node 20, `cache: npm`, khóa theo `app/frontend/package-lock.json`), sau đó `npm ci` và `npm run build`.

Phiên bản action lấy từ release mới nhất qua `gh api` ngày 2026-11-05: checkout v7.0.1, setup-java v6.2.0, setup-node v7.1.0, upload-artifact v7.0.2.

## Kiểm tra cục bộ

Lệnh: `cd app/backend && mvn -B -Djava.version=17 verify` (Maven 3.9.9 từ wrapper dists, JDK 17).

```
[INFO] argLine set to -javaagent:...org.jacoco.agent-0.8.16-runtime.jar=destfile=...\jacoco.exec
Tests run: 1  AdminInternFlowTest
Tests run: 2  ApiIntegrationTest
Tests run: 8  BusinessRuleTest
Tests run: 5  ErrorHandlingAndLoginLimitTest
[INFO] Tests run: 16, Failures: 0, Errors: 0, Skipped: 0
[INFO] --- jacoco:0.8.16:report (report) @ intern-management ---
[INFO] Analyzed bundle 'intern-management' with 35 classes
[INFO] BUILD SUCCESS
```

Đã có báo cáo JaCoCo: `jacoco.csv` và `index.html` trong `app/backend/target/site/jacoco/`.

## Độ phủ (tổng 35 lớp)

| Chỉ số | Được phủ / Tổng | Tỉ lệ |
|---|---|---|
| Dòng (line) | 238 / 300 | 79,33% |
| Nhánh (branch) | 165 / 349 | 47,28% |
| Lệnh (instruction) | — | 68,31% |

Hai cách tính cho ra cùng số liệu: một script Node riêng, và chính đoạn awk trong workflow chạy thử trên CSV thật.

Lưu ý: số liệu này bao gồm các test mà agent khác đang viết song song (`BusinessRuleTest`, `ErrorHandlingAndLoginLimitTest`, chưa được commit). Kết quả trên CI sẽ khác nếu các file đó thay đổi trước khi push.

## Kiểm tra YAML

Không parse được bằng thư viện: máy không có Python, còn việc tải `js-yaml` qua npx bị chặn. Thay vào đó đã kiểm tra thủ công: file không chứa tab, các mức thụt lề nhất quán (0/2/4/.../14), khóa `on`/`jobs`/`steps` đúng cấu trúc, và block scalar `run: |` đã được chạy thử thành công. Lần chạy CI thật sau khi push sẽ là bước xác nhận cuối cùng.

## Câu hỏi còn mở

- Không có.
