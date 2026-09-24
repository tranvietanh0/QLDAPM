"""Generate docs/WORKFLOW.md: the working process and role-to-role handoffs of the IMS project.

Handoff tables are derived from the dependencies in ims_details.DETAILS: when task X is done,
it is handed to the roles that own the tasks depending on X.
"""
import sys
from collections import defaultdict

from ims_data import CRITICAL_PATH, MILESTONE_GROUP, SPRINTS, WBS, is_group
from ims_details import DETAILS

TITLE = {t[0]: t[1] for t in WBS}
OWNER = {t[0]: t[2] for t in WBS}
TASKS = [t for t in WBS if not is_group(t[0]) and not t[0].startswith(MILESTONE_GROUP + ".")]
GROUP_NAMES = {t[0]: t[1] for t in WBS if is_group(t[0])}

NARRATIVE = r"""# Quy trình làm việc dự án IMS

> Tài liệu nội bộ: ai làm gì, xong thì bàn giao cho ai, bàn giao bằng gì.
> Một người (Trần Việt Anh) đảm nhận 5 vai trò **PM, BA, FE, BE, TEST**. "Bàn giao" ở đây nghĩa là
> **đổi vai trò** (đổi mũ) một cách có kỷ luật: đóng việc của vai trò trước bằng đầu ra rõ ràng, chuyển trạng
> thái trên Jira và để lại comment bàn giao, rồi mới bắt đầu việc của vai trò sau.
>
> Jira space key: **IM** · Board: **IMS board** · Sprint: **IMS Sprint 0..5** · Repo: `tranvietanh0/QLDAPM`

## Mục lục
1. [Nguyên tắc chung](#1-nguyên-tắc-chung)
2. [Vai trò và đầu ra](#2-vai-trò-và-đầu-ra)
3. [Trạng thái trên Jira và ai được chuyển](#3-trạng-thái-trên-jira-và-ai-được-chuyển)
4. [Chuỗi bàn giao tổng quát](#4-chuỗi-bàn-giao-tổng-quát)
5. [Vòng đời một User Story trong Sprint](#5-vòng-đời-một-user-story-trong-sprint)
6. [Quy trình xử lý Bug](#6-quy-trình-xử-lý-bug)
7. [Nhịp làm việc: ngày, tuần, Sprint](#7-nhịp-làm-việc-ngày-tuần-sprint)
8. [Git và liên kết Jira](#8-git-và-liên-kết-jira)
9. [Definition of Ready và Definition of Done](#9-definition-of-ready-và-definition-of-done)
10. [Mẫu comment bàn giao](#10-mẫu-comment-bàn-giao)
11. [Quản lý thay đổi (Change Request)](#11-quản-lý-thay-đổi-change-request)
12. [Bảng bàn giao chi tiết theo từng việc](#12-bảng-bàn-giao-chi-tiết-theo-từng-việc)

---

## 1. Nguyên tắc chung

| # | Nguyên tắc | Lý do |
|---|---|---|
| 1 | Mỗi việc có **đúng một vai trò chịu trách nhiệm** (label `PM/BA/FE/BE/TEST`, tiền tố `[BE]` trong summary) | Biết đang đội mũ nào, tiêu chí nào |
| 2 | **Không bắt đầu việc khi việc phụ thuộc chưa Done** (mục "PHỤ THUỘC" trong Description) | Tránh làm lại |
| 3 | Mỗi lần bàn giao phải có **đầu ra kiểm tra được** + **comment bàn giao** (mục 10) | Lưu vết cho báo cáo môn học |
| 4 | **Người viết code không tự đóng Story**: BE/FE → BA nghiệm thu → TEST kiểm thử → PM đóng | Giảm thiên kiến khi một người làm tất cả |
| 5 | **WIP tối đa 2** việc ở cột In Progress | Chống quá tải (rủi ro R-01) |
| 6 | Việc trên **đường găng** (Priority High, "ĐƯỜNG GĂNG" trong Description) được ưu tiên trước | Trễ là trễ cả dự án |
| 7 | Mọi thay đổi phạm vi sau mốc M1 đi qua **Change Request** | Kiểm soát scope creep (R-03) |

## 2. Vai trò và đầu ra

| Vai trò | Nhận đầu vào từ | Làm | Bàn giao đầu ra cho |
|---|---|---|---|
| **PM** | Giảng viên (yêu cầu đề tài), TEST (kết quả test), BA (backlog đã refine) | Kế hoạch, Sprint Planning, theo dõi, rủi ro, báo cáo | BA (phạm vi, kế hoạch), mọi vai trò (Sprint backlog) |
| **BA** | PM (scope), người dùng (khảo sát) | SRS, Use Case, User Story, AC, RTM, nghiệm thu nội bộ | FE/BE (AC đã chốt), TEST (AC để viết test case), PM (backlog sẵn sàng) |
| **FE** | BA (AC, sitemap), BE (API đã chạy + Swagger) | Wireframe, màn hình React | BA (màn hình để nghiệm thu) |
| **BE** | BA (FR, BR, AC), thiết kế ERD/API | CSDL, API, bảo mật, hạ tầng | FE (API + Swagger), TEST (endpoint để test Postman) |
| **TEST** | BA (AC), BE/FE (build đã qua nghiệm thu) | Test Plan, test case, chạy test, ghi Bug | BE/FE (Bug), PM (kết quả test để đóng Story) |

## 3. Trạng thái trên Jira và ai được chuyển

```
 To Do ──► In Progress ──► In Testing ──► Done
             ▲    (BE/FE)       │  (TEST)     (PM đóng Story sau khi TEST pass)
             └──── trả lại ─────┘  (TEST tạo Bug hoặc BA không nghiệm thu)
```

| Chuyển trạng thái | Ai thực hiện | Điều kiện |
|---|---|---|
| To Do → In Progress | Vai trò sở hữu việc | Việc phụ thuộc đã Done; WIP < 2 |
| In Progress → In Testing | BE/FE (Sub-task), BA (Story sau nghiệm thu) | Đạt DoD phía dev, PR đã merge vào `develop`, comment bàn giao |
| In Testing → Done | TEST (Sub-task/Task), PM (Story) | Test case liên quan đạt, không còn Bug S1/S2 mở |
| In Testing → In Progress | TEST hoặc BA | Có Bug hoặc không đạt AC; ghi rõ lý do |
| Task PM/BA không cần test | Chính vai trò đó | To Do → In Progress → Done khi đạt DoD |

## 4. Chuỗi bàn giao tổng quát

```
Sprint 0 (khởi động & thiết kế)
  PM: Charter → Scope → WBS/Gantt ─┐
                                   ▼
  BA: Khảo sát → SRS (FR/NFR/BR) → Use Case → User Story + AC → RTM
                                   │                         │
                                   ▼                         ▼
  FE: Sitemap → Wireframe      BE: Kiến trúc → ERD → OpenAPI   TEST: Test Plan (Sprint 1)
                                   │
  PM: Design Baseline (M1) ◄───────┘

Sprint 1..4 (mỗi Sprint lặp lại)
  BA chốt AC (x.1) ──► BE làm API ──► FE làm màn hình ──► BA nghiệm thu nội bộ
        │                                                        │
        └──► TEST viết test case                                 ▼
                                         TEST chạy test case (x.11) ──► PM Sprint Review/đóng Story
                                                  │
                                                  └──► Bug ──► BE/FE sửa ──► TEST verify
  BA refine backlog Sprint sau (x.12) ──► PM Sprint Planning Sprint sau

Sprint 5 (ổn định & phát hành)
  TEST hồi quy ──► BE/FE sửa bug S1/S2 ──► BE release v1.0.0 + môi trường UAT
      ──► BA điều phối UAT ──► TEST ghi lỗi UAT ──► BA UAT Sign-off ──► PM nghiệm thu (M6)
```

## 5. Vòng đời một User Story trong Sprint

Ví dụ **US-01 Đăng nhập** (Sprint 1). Mọi Story khác đi đúng các bước này.

| Bước | Vai trò | Việc (WBS) | Trạng thái Jira | Bàn giao cho | Bằng gì |
|---|---|---|---|---|---|
| 1 | PM | Sprint Planning (1.8) | Story vào IMS Sprint 1 | BA | Sprint Goal, Story được chọn |
| 2 | BA | Chốt AC (5.1) | Task 5.1 → Done | BE, FE, TEST | AC Given-When-Then trong Story, ma trận quyền |
| 3 | TEST | Viết test case từ AC (9.2) | Task 9.2 In Progress | (chờ build) | TC-AUTH-01..04 |
| 4 | BE | API login (5.2) | Sub-task → In Progress → In Testing | FE, TEST | PR merged, Swagger cập nhật, Postman chạy được |
| 5 | FE | Màn hình Login (5.3) | Sub-task → In Progress → In Testing | BA | PR merged, ảnh màn hình |
| 6 | BA | Nghiệm thu nội bộ (5.10) | Story → In Testing | TEST | Comment "AC1-AC3 đạt" hoặc trả lại |
| 7 | TEST | Chạy test (5.11) | Sub-task → Done, hoặc tạo Bug | PM hoặc BE/FE | Kết quả + ảnh evidence |
| 8 | PM | Sprint Review | Story → Done | - | Demo, cập nhật Burndown |

## 6. Quy trình xử lý Bug

| Bước | Vai trò | Hành động trên Jira |
|---|---|---|
| 1 | TEST | Create → **Bug**, summary `[BUG] <mô tả>`, Priority theo severity (S1 Highest, S2 High, S3 Medium, S4 Low), label `bug-S1..S4` + mã test case, link **is caused by** tới Sub-task/Story |
| 2 | TEST | Sub-task/Story liên quan trả về **In Progress** |
| 3 | BE hoặc FE | Nhận Bug → In Progress; sửa kèm test tái hiện; commit `IM-xx: fix ...` |
| 4 | BE hoặc FE | Bug → **In Testing**, comment bàn giao |
| 5 | TEST | Verify: đạt → **Done**; chưa đạt → trả về In Progress (Reopen) kèm lý do |
| 6 | PM | Theo dõi: S1 sửa trong ngày, S2 trong Sprint; không đóng Sprint khi còn S1/S2 |

## 7. Nhịp làm việc: ngày, tuần, Sprint

**Mỗi ngày**

| Khung giờ | Vai trò | Việc |
|---|---|---|
| 19:00 - 19:30 | PM | Daily log (hôm qua / hôm nay / vướng gì) vào comment, Log work, xem việc găng |
| 19:30 - 20:30 | BA | Chốt AC, trả lời câu hỏi nghiệp vụ, nghiệm thu |
| 20:30 - 22:00 | BE / FE | Code theo Sub-task (luân phiên theo ngày) |
| 22:00 - 22:30 | TEST | Test việc ở cột In Testing, ghi Bug |

**Mỗi tuần (Chủ nhật):** PM viết Weekly Status Report (SP hoàn thành, SPI/CPI, Bug mở, rủi ro).

**Mỗi Sprint (2 tuần)**

| Thời điểm | Vai trò | Việc | Đầu ra |
|---|---|---|---|
| Thứ Hai tuần 1 | PM | Sprint Planning, Start sprint | Sprint Goal |
| Thứ Hai - Thứ Ba tuần 1 | BA | Chốt AC (x.1) | AC chốt, bàn giao BE/FE/TEST |
| Tuần 1 - giữa tuần 2 | BE → FE | Phát triển | PR merged, Sub-task In Testing |
| Thứ Năm tuần 2 | BA | Nghiệm thu nội bộ (x.10) | Story In Testing |
| Thứ Năm - Thứ Sáu tuần 2 | TEST | Chạy test case (x.11) | Kết quả test, Bug |
| Thứ Sáu tuần 2 | BA | Refine backlog Sprint sau (x.12) | Story Sprint sau đạt DoR |
| Thứ Sáu tuần 2 | PM | Review, Retrospective, Complete sprint | Burndown, Sprint report, biên bản |

## 8. Git và liên kết Jira

| Mục | Quy ước |
|---|---|
| Nhánh | `main` (phát hành), `develop` (tích hợp), `feature/IM-<số>-mo-ta`, `hotfix/IM-<số>` |
| Commit | `IM-123: them API check-in` (có mã để Jira tự gắn commit vào work item) |
| Pull Request | Vào `develop`; tự review theo checklist: đúng AC, có test, không lộ secret, CI xanh |
| Tag | Cuối Sprint `v0.1`..`v0.4`, phát hành `v1.0.0` |
| Bàn giao BE → FE | PR merged vào `develop` + Swagger cập nhật + ví dụ request/response trong comment |

## 9. Definition of Ready và Definition of Done

**Definition of Ready** (BA kiểm tra trước Sprint Planning)
- [ ] Story có mô tả dạng "Là... tôi muốn... để..."
- [ ] Có ít nhất 2 Acceptance Criteria Given-When-Then
- [ ] Đã ước lượng Story Point
- [ ] Không còn phụ thuộc chưa xong; thiết kế UI/API liên quan đã có

**Definition of Done**
- [ ] Code merged vào `develop` qua PR, CI xanh
- [ ] Unit test tầng Service (BE) đạt
- [ ] BA nghiệm thu đạt toàn bộ AC
- [ ] Test case liên quan đạt, không còn Bug S1/S2 mở
- [ ] Swagger/tài liệu cập nhật, Log work đầy đủ

## 10. Mẫu comment bàn giao

Dán vào comment của work item mỗi khi chuyển trạng thái để bàn giao:

```
[BÀN GIAO] BE → FE, TEST
Việc: IM-xx [BE] 5.2 API login
Đầu ra: PR #12 merged vào develop; Swagger /api/v1/auth/*
Cách kiểm tra: Postman collection "Auth" (TC-AUTH-01..04)
Lưu ý: token hạn 8 giờ; tài khoản khóa trả 403
Việc tiếp theo mở khóa: 5.3 (FE), 5.4 (BE), 5.11 (TEST)
```

```
[NGHIỆM THU] BA → TEST
Story: IM-xx US-01 Đăng nhập
Kết quả: AC1 đạt, AC2 đạt, AC3 đạt
Chuyển In Testing để TEST chạy TC-AUTH-01..04
```

```
[KẾT QUẢ TEST] TEST → PM
Story: IM-xx US-01 | Chạy 4/4 test case: 4 đạt, 0 lỗi
Evidence: ảnh đính kèm | Đề nghị đóng Story
```

## 11. Quản lý thay đổi (Change Request)

1. Ghi nhận yêu cầu thay đổi: tạo Task `[CR] <mô tả>`, label `change-request`.
2. **BA** phân tích tác động: FR/BR/AC/RTM bị ảnh hưởng.
3. **PM** đánh giá tác động lịch, chi phí, rủi ro so với baseline Gantt.
4. Ảnh hưởng mốc → hỏi ý kiến giảng viên. Quyết định ghi vào comment.
5. Được duyệt: BA cập nhật AC/RTM (việc 2.9), PM cập nhật backlog và Gantt, thông báo vai trò liên quan.

"""


def successors():
    succ = defaultdict(list)
    for tid, detail in DETAILS.items():
        for dep in detail[4]:
            succ[dep].append(tid)
    return succ


def handoff_tables():
    succ = successors()
    out = ["## 12. Bảng bàn giao chi tiết theo từng việc", "",
           "Sinh tự động từ phần phụ thuộc trong `src/ims_details.py`. Cột **Bàn giao cho** là vai trò của các "
           "việc chỉ được bắt đầu khi việc này xong. Việc có ★ nằm trên đường găng.", ""]
    for gid, name in GROUP_NAMES.items():
        rows = [t for t in TASKS if t[0].split(".")[0] == gid]
        if not rows:
            continue
        out += [f"### {gid}. {name}", "",
                "| WBS | Vai trò | Việc | Đầu ra bàn giao | Bàn giao cho | Việc được mở khóa |",
                "|---|---|---|---|---|---|"]
        for tid, title, owner, *_ in rows:
            nxt = sorted(succ.get(tid, []), key=lambda x: [int(p) for p in x.split(".")])
            roles = sorted({OWNER[n] for n in nxt}, key=["PM", "BA", "FE", "BE", "TEST"].index)
            star = " ★" if tid in CRITICAL_PATH else ""
            deliverable = DETAILS[tid][2]
            out.append(f"| {tid}{star} | {owner} | {title} | {deliverable} | "
                       f"{', '.join(roles) if roles else 'PM (đóng việc)'} | {', '.join(nxt) if nxt else '-'} |")
        out.append("")
    ms = [t for t in WBS if t[0].startswith(MILESTONE_GROUP + ".")]
    out += ["### Mốc kiểm soát", "", "| Mốc | Ngày | Người kiểm tra |", "|---|---|---|"]
    out += [f"| {t[1]} | {t[3]:%d/%m/%Y} | PM (go/no-go) |" for t in ms]
    out += ["", "---", f"_Sinh bằng `python src/build_workflow_md.py docs/WORKFLOW.md`. "
                       f"Sprint: {', '.join(s[1] for s in SPRINTS)}._", ""]
    return "\n".join(out)


def main(path):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(NARRATIVE + handoff_tables())
    print("saved", path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "WORKFLOW.md")
