# Báo cáo: Video demo hoàn chỉnh "Đội AI agent + IMS chạy thật"

**Trạng thái:** Hoàn thành, có lưu ý (xem mục "Lưu ý").

## Kết quả

| Mục | Giá trị |
|---|---|
| File | `docs/video/IMS_demo.mp4` (đã ghi đè) |
| Thời lượng | 6:36 (396,36 s theo ffprobe) |
| Định dạng | 1440x900, H.264 High, yuv420p, 25 fps, 9909 khung hình, không có luồng âm thanh, `+faststart` (moov nằm trước mdat) |
| Dung lượng | 24.466.396 byte (23,3 MiB) |
| Phần web cũ | `docs/video/IMS_web_segment.mp4` (2.630.689 byte), bản sao nguyên vẹn của video web 2:29 trước đây |
| Phần trung gian | `docs/video/agent_ch1.mp4` (4.977.223 byte), `docs/video/agent_ch2.mp4` (20.129.888 byte) |
| Dữ liệu chụp thật | `docs/video/agent_capture/` (242.692 byte): `terminal-pre/head/post/verify/ci.json` và `claude-stream.jsonl` |

Video chỉ có phụ đề tiếng Việt, không có lời đọc hay nhạc. Video có thẻ tiêu đề, 3 thẻ chương, chuyển cảnh xfade (fade, smoothleft, fadeblack), con trỏ đỏ với hiệu ứng nhấn, zoom nhẹ vào dòng quan trọng, nhãn "×N" khi tua nhanh, và thẻ tổng kết. Mọi cảnh terminal đều có nhãn "Phát lại phiên chạy thật (đã tua nhanh)".

## Mốc thời gian chương

| Mốc | Nội dung |
|---|---|
| 00:00 | Thẻ tiêu đề: "Xây dựng dự án phần mềm bằng đội AI Agent", "Hệ thống quản lý thực tập sinh (IMS)", môn Quản lý dự án phần mềm, SV Trần Việt Anh |
| 00:06 | Thẻ Chương 1 "Đội AI agent và AgentKit" |
| 00:09 | Sơ đồ vai trò agent (planner → fullstack-developer → tester → code-reviewer → docs-manager) |
| ~00:15 | `ak --version`, `ak doctor` (zoom vào dòng hook registration và dòng Summary: 24 OK, 2 cảnh báo, 0 lỗi) |
| ~00:33 | `ls .claude/agents` (16 agent), con trỏ nhấn `tester.md`, `head -n 7 .claude/agents/tester.md` (zoom vào `model: haiku` và `tools:`) |
| ~00:50 | `ls plans/reports` (14 báo cáo có sẵn) |
| 00:58 | Thẻ Chương 2 "Agent làm việc thật" |
| 01:01 | Lỗi thật: `git show HEAD:…application.properties \| grep -n "app.cors.origins"` cho thấy CORS mặc định chỉ có 5173 |
| ~01:12 | Gõ lệnh `claude -p …` (headless) |
| ~01:25 | Spawn `fullstack-developer` "Add CORS origins 5174", Edit 2 file (zoom vào dòng `+`), kết thúc `Status: DONE` |
| ~01:55 | Spawn `tester` "Run backend Maven tests", có một lệnh bị `permission_denied` thật, chạy `mvn` (×14), 26 test pass, `Status: DONE_WITH_CONCERNS` |
| ~02:30 | Spawn `code-reviewer` "Review CORS 5174 diff", kết thúc `Status: DONE_WITH_CONCERNS`, sau đó agent chính tóm tắt kết quả |
| ~03:15 | Kiểm tra độc lập: `git status --short`, `git diff -- app/backend`, `ls plans/reports` (3 báo cáo mới được tô xanh) |
| ~03:30 | Con trỏ mở `plans/reports/tester-261105-1121-cors-5174.md` trong khung xem file và cuộn qua nội dung |
| ~03:45 | Tự chạy lại `mvn … verify` (×10): `Tests run: 26, Failures: 0, Errors: 0`, BUILD SUCCESS |
| ~03:55 | `gh run list --limit 3`, `gh run view 41964359167`: 2 job đều ✓ |
| 04:06 | Thẻ Chương 3 "Ứng dụng chạy thật" |
| 04:10 | Đoạn web có sẵn, cắt từ 5,00 s đến 140,84 s của `IMS_web_segment.mp4`, tức bỏ thẻ mở đầu và thẻ kết cũ (thẻ kết cũ ghi "19 test", đã lỗi thời) |
| 06:25 | Thẻ tổng kết: 26/26 test backend, CI xanh (2/2 job), mutation 6/6, độ phủ dòng 80,32%, 3 subagent sửa lỗi trong 4 phút 20 giây |

Các mốc có dấu "~" được ước lượng từ khung hình trích ra. Các mốc không có dấu "~" do script ghép video in ra.

## Lệnh Claude Code lồng nhau (đã chạy thật)

Lệnh chạy từ thư mục gốc repo lúc 2026-11-05 11:21:25 (+07). Thư mục `bin` của Maven được thêm vào đầu PATH. Lệnh không dùng `--dangerously-skip-permissions` hay `bypassPermissions`. Script `node src/record_agent_demo.mjs claude` chạy lệnh này và ghi từng dòng stream kèm thời điểm nhận.

```
claude -p "Sửa một lỗi thật trong dự án IMS: cổng Admin chạy dev ở http://localhost:5174 (Vite) bị HTTP 403 với mọi yêu cầu POST/PUT, vì danh sách CORS mặc định của backend (app.cors.origins, đọc bởi CorsConfig.java) chỉ có cổng 5173. Hãy điều phối đội agent theo đúng thứ tự sau, mỗi bước dùng đúng một subagent: 1) Agent fullstack-developer: thêm http://localhost:5174 và http://127.0.0.1:5174 vào giá trị CORS mặc định ở app/backend/src/main/resources/application.properties (dòng app.cors.origins) và vào dòng chú thích CORS_ORIGINS trong app/backend/.env.example. Giữ nguyên hai origin 5173 hiện có. Không sửa file mã nguồn nào khác (CorsConfig.java chỉ đọc để hiểu). 2) Sau đó agent tester: chạy đúng lệnh `mvn -o -B -Djava.version=17 -f app/backend/pom.xml test` từ thư mục gốc repo (Maven 3.9.9 ở C:/Users/tranv/.m2/wrapper/dists/apache-maven-3.9.9/3477a4f1/bin/mvn, đã có trên PATH với tên mvn; chạy offline) và báo số test chạy/thất bại. 3) Cuối cùng agent code-reviewer: review `git diff` của thay đổi (chỉ đọc, không sửa code). Mỗi agent ghi một báo cáo ngắn bằng tiếng Việt vào plans/reports/ (tên file có đuôi -cors-5174.md) và kết thúc câu trả lời bằng một dòng `Status: DONE | DONE_WITH_CONCERNS | BLOCKED`. Không commit, không chạy lệnh git nào ngoài git diff/git status. Cuối cùng tóm tắt kết quả bằng tiếng Việt." --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools "Read,Grep,Glob,Edit,Write,Agent,Task,Bash(mvn:*),Bash(git diff:*),Bash(git status:*),Bash(ls:*)"
```

Phiên chạy có `result/success`, `is_error=false`, kéo dài 259,9 s qua 5 lượt. Model chính là `claude-opus-5-5`, Claude Code 2.1.318.

## Các agent đã chạy

| Agent | Model | Nhiệm vụ | Thời gian | Dòng Status | Báo cáo |
|---|---|---|---|---|---|
| fullstack-developer | claude-opus-5-5 | "Add CORS origins 5174" | 50 s | `Status: DONE` | `plans/reports/fullstack-developer-261105-1121-cors-5174.md` |
| tester | claude-haiku-5-5 | "Run backend Maven tests" | 48 s | `Status: DONE_WITH_CONCERNS` (chưa có test CORS riêng cho 5174) | `plans/reports/tester-261105-1121-cors-5174.md` |
| code-reviewer | claude-opus-5-5 | "Review CORS 5174 diff" | 1 phút 31 s | `Status: DONE_WITH_CONCERNS` (chưa có test CORS; cổng 5174 chưa ghi trong `app/`; biến `CORS_ORIGINS` đặt sẵn trên máy sẽ ghi đè giá trị mặc định) | `plans/reports/code-reviewer-261105-1121-cors-5174.md` |

Có đúng một lần bị từ chối quyền (`system/permission_denied`). Tester gửi lệnh ghép `cd … && date … && mvn … ; echo "EXIT=$?"`, phần `echo` không nằm trong `--allowedTools` nên bị chặn. Tester sau đó tự chạy lại lệnh `mvn` mà không có phần đó. Video hiển thị lần từ chối này kèm chú thích.

## Thay đổi CORS (git diff)

Chỉ có 2 file mã bị sửa, mỗi file một dòng. Hai origin 5173 vẫn giữ nguyên:

- `app/backend/src/main/resources/application.properties:14`: `app.cors.origins=${CORS_ORIGINS:http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174}`
- `app/backend/.env.example:7`: dòng chú thích `# CORS_ORIGINS=…` thêm cùng hai origin 5174.

Ngoài ra có thêm 3 báo cáo mới (`*-261105-1121-cors-5174.md`). `CorsConfig.java` và `app/frontend` không bị sửa. Không có commit nào.

## Kết quả test

- Tester (trong phiên lồng): `mvn -o -B -Djava.version=17 -f app/backend/pom.xml test` cho BUILD SUCCESS, 26 test chạy, 0 thất bại, 0 lỗi.
- Tự kiểm chứng sau phiên: `mvn -o -B -Djava.version=17 -f app/backend/pom.xml verify` cho `Tests run: 26, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS, 24,0 s. Theo JaCoCo của lần chạy này, độ phủ dòng là 253/315 = **80,32%**. Con số 79,33% trong đề bài là số đo cũ lúc mới có 16 test, nên thẻ tổng kết dùng số đo mới.
- CI: `gh run view 41964359167` (commit `34f73e4`) có cả 2 job ✓: "Backend (Maven verify + JaCoCo)" 31 s và "Frontend (npm build)" 11 s.
- Mutation 6/6 lấy từ `plans/reports/tester-261105-1040-mutation-check.md`.

Script ghép đọc mọi con số trên thẻ tổng kết từ dữ liệu đã chụp. Nếu thiếu một con số, hoặc `jacoco.csv` cũ hơn lần chạy verify đã chụp, script dừng và báo lỗi.

## Lệnh tạo lại

Chạy trong Git Bash từ thư mục gốc repo. Cần Node 22+, Edge, ffmpeg (đường dẫn mặc định trong script, ghi đè bằng `FFMPEG`), `ak`, `gh` và `claude`.

```bash
# 1. Chụp các lệnh thật (stdout kèm thời gian từng dòng)
node src/record_agent_demo.mjs capture pre      # ak --version, ak doctor, ls .claude/agents, head tester.md, ls plans/reports
node src/record_agent_demo.mjs capture head     # dòng CORS trong bản đã commit
node src/record_agent_demo.mjs capture ci       # gh run list --limit 3, gh run view <id mới nhất>
# 2. Phiên Claude Code lồng (sửa file thật, tốn token; RAW_DIR = nơi lưu stream gốc chưa che)
RAW_DIR=<thư mục tạm> node src/record_agent_demo.mjs claude
# 3. Kiểm tra sau phiên
node src/record_agent_demo.mjs capture post     # git status --short, git diff -- app/backend, ls plans/reports
node src/record_agent_demo.mjs capture verify   # mvn verify (cũng tạo jacoco.csv cho thẻ tổng kết)
# 4. Quay 2 chương terminal -> docs/video/agent_ch1.mp4, agent_ch2.mp4 (khoảng 5 phút)
node src/record_agent_demo.mjs record
# 5. Ghép video cuối -> docs/video/IMS_demo.mp4 (khoảng 1 phút)
node src/compose_demo_video.mjs
```

Chỉ cần chạy lại bước 4 và 5 là dựng lại được video từ dữ liệu đã chụp, không phải chạy lại agent.

## File đã tạo/sửa

- `src/record_agent_demo.mjs` (mới, 715 dòng): các lệnh capture, claude và record. Trang phát lại dạng terminal gồm: thanh chương, nhãn phát lại, đồng hồ "thời gian thật", huy hiệu ×N, khung chờ, bảng "Đội agent" với thẻ trạng thái từng subagent, khung xem file báo cáo, con trỏ và zoom.
- `src/compose_demo_video.mjs` (mới, 192 dòng): dựng thẻ HTML bằng Edge headless, zoom chậm bằng zoompan, nối các đoạn bằng xfade, đọc số liệu từ dữ liệu đã chụp.
- `src/cdp_browser.mjs`: chỉ thêm `createRecorder` (vòng chụp `captureScreenshot` và encode ffconcat) và bổ sung import. Các export cũ giữ nguyên.
- `docs/video/IMS_demo.mp4` (ghi đè), `docs/video/IMS_web_segment.mp4`, `docs/video/agent_ch1.mp4`, `docs/video/agent_ch2.mp4`, `docs/video/agent_capture/*`.
- Do phiên Claude lồng sửa: `app/backend/src/main/resources/application.properties`, `app/backend/.env.example`, và 3 báo cáo `plans/reports/*-261105-1121-cors-5174.md`.

## Kiểm tra đã làm

- Chạy ffprobe trên file cuối: đúng các thông số ở bảng đầu, không có luồng audio.
- Trích 30 khung hình trải đều từ 0 đến 396 s và tự xem từng khung: thẻ tiêu đề, cả 3 thẻ chương, ak doctor, danh sách agent, lúc spawn từng subagent, thẻ Status, ×N, khung xem báo cáo, mvn verify, CI, phần web và thẻ tổng kết đều đọc được. Không có khung trắng hay trống. Ở 00:06 thấy cảnh đang chuyển (xfade) giữa thẻ tiêu đề và thẻ Chương 1, đúng như thiết kế.
- Quét dữ liệu đã chụp: không có email cá nhân (email tài khoản trong `ak doctor` hiện thành "[email đã ẩn]") và không có token. Chỉ còn các email demo công khai (admin@/mentor@gmail.com) và URL repo GitHub.

## Lưu ý

1. **Backend đang chạy ở :8081 chưa nhận cấu hình CORS mới.** Theo yêu cầu, tôi không dừng backend. Muốn cổng :5174 POST/PUT được trên trình duyệt thường thì phải khởi động lại backend. Ngoài ra, nếu máy đã đặt sẵn biến `CORS_ORIGINS` thì biến đó vẫn ghi đè giá trị mặc định mới.
2. **Một số dòng trong video là trích đoạn.** Mỗi dòng của cảnh Claude được dựng từ một sự kiện stream-json thật: văn bản agent, lời gọi công cụ và tham số, kết quả công cụ, `permission_denied` và `result`. Kết quả dài bị cắt và có dấu "… +N dòng". Riêng output Maven chỉ hiện các dòng tổng kết, có ghi rõ "(N dòng output; hiển thị các dòng tổng kết)". Đường dẫn trong nhãn Read, Edit, Write và Grep được rút gọn thành đường dẫn tương đối, giống giao diện Claude Code. Lệnh Bash được giữ nguyên văn.
3. **Sơ đồ vai trò ở đầu Chương 1 là slide minh hoạ**, không phải output terminal. Phụ đề của cảnh này nói rõ điều đó.
4. **Dung lượng `docs/video/`.** Hai file trung gian `agent_ch1.mp4` và `agent_ch2.mp4` (tổng khoảng 24 MB) được giữ lại vì script ghép cần đọc chúng. Có thể xoá sau khi đã có video cuối. Tôi chưa commit gì.

## Câu hỏi còn mở

- Có cần thêm test CORS cho origin 5174 không? Cả tester và code-reviewer đều đề xuất việc này. Tôi không làm vì nằm ngoài phạm vi.
- Có cần ghi lệnh chạy cổng Admin :5174 vào `app/README.md` không?
