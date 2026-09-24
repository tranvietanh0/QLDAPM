# IMS - Intern Management System (QLDAPM - PTIT)

Hồ sơ quản lý dự án môn Quản lý dự án phần mềm. Sinh viên: Trần Việt Anh (kiêm PM, BA, FE, BE, TEST).

Mọi số liệu (WBS, ngày, giờ công, User Story, test case, rủi ro) nằm trong `src/ims_data.py`.
Ba file đầu ra được sinh từ cùng nguồn đó nên luôn khớp nhau:

| Lệnh | Đầu ra |
|---|---|
| `python src/build_docx.py out/IMS_Bao_cao_QLDAPM.docx` | Báo cáo Word đầy đủ |
| `python src/build_gantt.py out/IMS_Gantt_Chart.xlsx` | Gantt 12 tuần / 6 Sprint + phân bổ nguồn lực |
| `python src/build_jira_csv.py out/IMS_Jira_Import.csv --sprint-ids 1,2,3,4,5,6 --assignee you@mail.com` | CSV import Jira (131 work item) |
| `python src/build_jira_csv.py out/IMS_Jira_Test_5rows.csv --sample` | CSV thử 5 dòng |
| `python src/build_jira_guide.py out/Huong_dan_Jira_IMS.docx` | Hướng dẫn Jira từng bước |

Chạy từ thư mục `src/` (các script import `ims_data`). Trên Windows đặt `PYTHONIOENCODING=utf-8` nếu terminal báo lỗi Unicode.
