# IMS - Intern Management System (QLDAPM - PTIT)

Hồ sơ quản lý dự án môn Quản lý dự án phần mềm. Sinh viên: Trần Việt Anh (kiêm PM, BA, FE, BE, TEST).

**Quy trình làm việc và bàn giao giữa các vai trò: [docs/WORKFLOW.md](docs/WORKFLOW.md)**

**Báo cáo nộp môn (đội AI Agent + AgentKit): [docs/BaoCao_QLDAPM_AI_Agent_IMS.docx](docs/BaoCao_QLDAPM_AI_Agent_IMS.docx) ([PDF](docs/BaoCao_QLDAPM_AI_Agent_IMS.pdf)) · Video demo: [docs/video/IMS_demo.mp4](docs/video/IMS_demo.mp4)**

Mọi số liệu (WBS, ngày, giờ công, User Story, test case, rủi ro) nằm trong `src/ims_data.py`.
Ba file đầu ra được sinh từ cùng nguồn đó nên luôn khớp nhau:

| Lệnh | Đầu ra |
|---|---|
| `python src/build_docx.py out/IMS_Bao_cao_QLDAPM.docx` | Báo cáo Word đầy đủ |
| `python src/build_gantt.py out/IMS_Gantt_Chart.xlsx` | Gantt 12 tuần / 6 Sprint + phân bổ nguồn lực |
| `python src/build_jira_csv.py out/IMS_Jira_Import.csv --sprint-ids 1,2,3,4,5,6 --assignee you@mail.com` | CSV import Jira (131 work item) |
| `python src/build_jira_csv.py out/IMS_Jira_Test_5rows.csv --sample` | CSV thử 5 dòng |
| `python src/build_jira_guide.py out/Huong_dan_Jira_IMS.docx` | Hướng dẫn Jira từng bước |
| `python src/build_workflow_md.py docs/WORKFLOW.md` | Quy trình làm việc + bảng bàn giao |

Chạy từ thư mục `src/` (các script import `ims_data`). Trên Windows đặt `PYTHONIOENCODING=utf-8` nếu terminal báo lỗi Unicode.

## Mã nguồn ứng dụng

Ứng dụng IMS (Spring Boot API + React/Vite client + Electron desktop) nằm trong [`app/`](app/README.md).
Chạy nhanh bản demo H2: `cd app/backend && mvn spring-boot:run -Dspring-boot.run.profiles=demo`, sau đó ở terminal khác `cd app && npm run client:browser` và mở http://localhost:5173.
