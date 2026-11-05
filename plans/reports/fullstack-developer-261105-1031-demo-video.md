# Báo cáo: Video demo IMS (tự động, headless Edge)

**Trạng thái:** Hoàn thành, có lưu ý (xem mục "Điều chỉnh / lưu ý").

## Kết quả

| Mục | Giá trị |
|---|---|
| File | `docs/video/IMS_demo.mp4` |
| Thời lượng | 2:29 (149,76 s theo ffprobe) |
| Độ phân giải | 1440x900, H.264 High, yuv420p, 25 fps, không có âm thanh |
| Dung lượng | 2.630.689 byte (khoảng 2,5 MB) |
| Số khung hình chụp | 1577 ảnh JPEG, ffmpeg dựng lại thành 25 fps cố định theo timestamp |

## Lệnh tạo lại video

Yêu cầu: API ở :8081, cổng thực tập sinh ở :5173, cổng Admin/Mentor ở :5174 (xem `app/README.md`).

```bash
# Bash (Git Bash)
IMS_DEMO_PASSWORD=<mật khẩu demo trong app/README.md> node src/record_demo_video.mjs
# Tuỳ chọn: FFMPEG=<đường dẫn ffmpeg.exe>, FRAMES_DIR=<thư mục giữ khung hình>, tham số 1 = file mp4 đầu ra
```

Mỗi lần chạy sẽ ghi dữ liệu thật vào MySQL: 1 công việc, 1 báo cáo tuần (lấy số tuần trống đầu tiên từ 10 trở lên) và 1 lượt chấm điểm.

## Các bước trong video (mốc thời gian)

| Mốc | Bước |
|---|---|
| 00:00 | Màn hình mở đầu: "IMS – Hệ thống quản lý thực tập sinh · Demo chạy thật (Spring Boot + MySQL)" |
| 00:05 | Admin đăng nhập qua form của cổng Admin (gõ email/mật khẩu từng ký tự) |
| 00:16 | Trang Tổng quan của Admin, khoanh vùng menu "Quản trị hệ thống" |
| 00:19 | Danh sách Thực tập sinh; sau đó Admin đăng xuất |
| 00:27 | Mentor đăng nhập qua cùng form của cổng Admin |
| 00:36 | Trang Tổng quan của Mentor, khoanh vùng menu (không có "Quản trị hệ thống") |
| 00:40 | Mentor giao việc "Viết API báo cáo tuần" cho Nguyen Van An, ưu tiên Cao, hạn 27/11/2026 |
| 01:01 | Thông báo "Đã giao công việc", công việc ở trạng thái "Chưa bắt đầu" (TODO) |
| 01:05 | Thực tập sinh đăng nhập ở cổng Client (:5173) |
| 01:15 | Mục "Công việc của tôi" hiển thị công việc mới |
| 01:20 | Bấm "Bắt đầu", nhập ghi chú, chuyển TODO → IN_PROGRESS |
| 01:27 | Trạng thái "Đang thực hiện" |
| 01:31 | Chú thích quy tắc chuyển trạng thái, khoanh vùng nút "Hoàn thành" |
| 01:36 | Báo cáo tuần: nộp báo cáo tuần 10 |
| 01:57 | Báo cáo ở trạng thái "Chờ đánh giá" (SUBMITTED) |
| 02:01 | Mentor quay lại cổng Admin, mở Báo cáo tuần, bấm "Chấm điểm" và cho 9 điểm kèm nhận xét |
| 02:16 | Báo cáo ở trạng thái "Đã đánh giá" (REVIEWED), 9.0/10 |
| 02:20 | Màn hình kết: "Đội AI Agent (AgentKit): 19 test tự động · CI GitHub Actions xanh · Không còn lỗi High về phân quyền" |

Mỗi bước có thanh chú thích tiếng Việt cỡ chữ lớn. Thanh này nằm ở cuối trang, và tự chuyển lên đầu trang khi có hộp thoại để không che nút. Video có thêm con trỏ chuột đỏ với hiệu ứng nhấn, và khung vàng làm nổi phần tử được nói tới. Tôi đã kiểm tra 30 khung hình trích bằng ffmpeg: không có khung trắng hoặc trống, và không có thông báo lỗi nào.

## Điều chỉnh / lưu ý

1. **Lỗi CORS ở cổng Admin chạy bằng Vite (:5174).** Khi chạy dev, mọi yêu cầu POST/PUT từ :5174 đều nhận HTTP 403. Nguyên nhân là `app.cors.origins` mặc định chỉ có :5173. Ứng dụng desktop Admin thật không gặp lỗi này vì proxy cùng origin của nó xoá header `Origin` (`app/desktop/main.cjs:28-30`). Script quay video làm giống proxy desktop: qua CDP `Fetch` nó xoá `Origin` cho các yêu cầu `/api` cùng origin của :5174. Tôi không sửa gì trong `app/`. Nếu muốn chạy cổng Admin trên trình duyệt thường, cần thêm `http://127.0.0.1:5174,http://localhost:5174` vào `CORS_ORIGINS`.
2. **Không thử được chuyển trạng thái sai qua giao diện.** Giao diện chỉ hiện nút cho bước hợp lệ tiếp theo, nên video dùng chú thích để giải thích quy tắc và khoanh vùng nút "Hoàn thành".
3. **Thực tập sinh không đăng nhập lại ở bước chấm điểm.** Mentor vẫn còn phiên đăng nhập ở :5174, nên video chỉ mở lại cổng này, không đăng nhập lại.
4. **Dữ liệu thử.** Những lần chạy thử bị lỗi đã tạo thêm 4 công việc trùng (id 2-5) và 3 báo cáo (tuần 10-12). Tôi đã xoá chúng qua API Admin trước lần quay cuối. Trạng thái DB hiện tại: công việc #1 có sẵn từ trước; công việc #6 "Viết API báo cáo tuần" ở trạng thái IN_PROGRESS; báo cáo #4 tuần 10 ở trạng thái REVIEWED, 9 điểm. Không có lần đăng nhập sai mật khẩu nào. Script cũng kiểm tra lại giá trị đã gõ trước khi bấm Đăng nhập.
5. **Độ tin cậy CDP.** `Page.startScreencast` dừng lại sau khi điều hướng sang tiến trình khác, còn `captureScreenshot` thỉnh thoảng không trả lời. Cách xử lý: chụp liên tục bằng `captureScreenshot` khoảng 12 ảnh/giây và tạm dừng khi đang điều hướng; dùng tab gốc thay vì tab mới mở qua `/json/new`; thêm các cờ tắt throttling/occlusion; đặt timeout 30 s cho mọi lệnh CDP. Video cuối được quay trước khi thêm các cờ tắt throttling. Sau khi thêm, tôi chạy `capture_report_figures.mjs` 4 lần liên tiếp (từ bản sao trong scratchpad) và lần nào cũng ghi đủ 7 ảnh. Tôi chưa quay lại video với các cờ này vì không được phép xoá dữ liệu demo, mà quay lại thì sẽ tạo thêm công việc và báo cáo trùng.

## File đã tạo/sửa

- `src/cdp_browser.mjs` (mới): `openPage`, `apiLogin`, `sleep`, `API`.
- `src/record_demo_video.mjs` (mới).
- `src/capture_report_figures.mjs`: chỉ tách code dùng chung sang `cdp_browser.mjs`, hành vi giữ nguyên.
- `docs/video/IMS_demo.mp4` (mới).
