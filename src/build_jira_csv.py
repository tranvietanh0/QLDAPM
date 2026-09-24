"""Build the Jira Cloud CSV (External System Import) for the IMS backlog.

Hierarchy: Epic (WBS groups 1-10) > Story (US-01..US-16) / Task > Sub-task.
Rows are ordered parents-first, which the Jira importer requires.

Usage:
    python build_jira_csv.py OUT.csv
    python build_jira_csv.py OUT.csv --sprint-ids 1,2,3,4,5,6 --assignee you@mail.com
    python build_jira_csv.py OUT.csv --sample      # 6-row smoke-test file

--sprint-ids takes the numeric IDs of Sprint 0..Sprint 5 created on your board,
in that order. Jira cannot create sprints from CSV and rejects sprint names.
"""
import argparse
import csv

from ims_data import (CONTINUOUS_TASKS, CRITICAL_PATH, MILESTONE_GROUP, ROLE_NAMES, SPRINTS,
                      US_TITLES, USER_STORIES, WBS, children, is_group, sprint_of)
from ims_details import DETAILS, EPIC_DETAILS, MILESTONE_DETAILS

HEADER = ["Work item ID", "Work type", "Summary", "Parent", "Description", "Priority",
          "Assignee", "Sprint", "Story point estimate", "Original Estimate",
          "Start date", "Due date", "Labels", "Labels", "Labels"]
DATE_FMT = "%d/%m/%Y"  # map in the wizard as dd/MM/yyyy
SECONDS_PER_HOUR = 3600
EPIC_ID_BASE, STORY_ID_BASE, ITEM_ID_BASE = 1, 101, 1001


def bullets(items):
    return "\n".join(f"- {x}" for x in items)


def task_description(tid, owner, start, due, hours, us):
    title_of = {t[0]: t[1] for t in WBS}
    if tid.startswith(MILESTONE_GROUP + "."):
        return (f"MỐC KIỂM SOÁT {tid} - ngày {due:%d/%m/%Y}\n\nTIÊU CHÍ ĐẠT\n- {MILESTONE_DETAILS[tid]}\n\n"
                "CÁCH XỬ LÝ\n- PM kiểm tra tiêu chí vào ngày mốc, ghi kết quả go/no-go vào comment "
                "và Weekly Status Report")
    if tid not in DETAILS:
        raise SystemExit(f"Missing description for WBS {tid} in ims_details.py")
    goal, steps, deliverable, dod, deps, refs = DETAILS[tid]
    parts = [f"MỤC TIÊU\n{goal}", f"VIỆC CẦN LÀM\n{bullets(steps)}", f"ĐẦU RA\n- {deliverable}",
             f"TIÊU CHÍ HOÀN THÀNH (DoD)\n{bullets(dod)}"]
    if deps:
        parts.append("PHỤ THUỘC (chỉ bắt đầu khi xong)\n" + bullets(f"WBS {d} {title_of[d]}" for d in deps))
    if refs:
        parts.append(f"THAM CHIẾU\n- {refs}" + (f"; User Story {us}" if us else ""))
    info = (f"THÔNG TIN\n- Vai trò: {owner} ({ROLE_NAMES[owner]}) | WBS {tid}\n"
            f"- Kế hoạch: {start:%d/%m/%Y} - {due:%d/%m/%Y}, ước lượng {hours} giờ")
    if tid in CRITICAL_PATH:
        info += "\n- ĐƯỜNG GĂNG: trễ việc này là trễ cả dự án"
    if tid in CONTINUOUS_TASKS:
        info += "\n- Việc lặp lại mỗi Sprint: cập nhật tiến độ trong comment, đóng khi kết thúc dự án"
    parts.append(info)
    return "\n\n".join(parts)


def epic_description(gid, owner, start, due):
    scope, exit_criteria = EPIC_DETAILS[gid]
    kids = children(gid)
    return (f"PHẠM VI\n{scope}\n\nTIÊU CHÍ HOÀN THÀNH EPIC\n{bullets(exit_criteria)}\n\n"
            f"CÔNG VIỆC CON ({len(kids)})\n" + bullets(f"{k[0]} [{k[2]}] {k[1]}" for k in kids) +
            f"\n\nTHÔNG TIN\n- Vai trò chính: {owner} ({ROLE_NAMES[owner]})\n"
            f"- Kế hoạch: {start:%d/%m/%Y} - {due:%d/%m/%Y}")


def sprint_label(day):
    return "Sprint-" + str(SPRINTS.index(sprint_of(day)))


def row(item_id, work_type, summary, parent="", description="", priority="Medium", assignee="",
        sprint="", sp="", hours=None, start=None, due=None, labels=()):
    labels = list(labels) + [""] * (3 - len(labels))
    return [item_id, work_type, summary, parent, description, priority, assignee, sprint, sp,
            int(hours * SECONDS_PER_HOUR) if hours else "",
            start.strftime(DATE_FMT) if start else "", due.strftime(DATE_FMT) if due else ""] + labels[:3]


def build_rows(sprint_ids, assignee):
    sprint_id = {}
    if sprint_ids:
        if len(sprint_ids) != len(SPRINTS):
            raise SystemExit(f"--sprint-ids needs {len(SPRINTS)} values (Sprint 0..5), got {len(sprint_ids)}")
        sprint_id = {s[0]: sid for s, sid in zip(SPRINTS, sprint_ids)}

    def sprint_for(day):
        return sprint_id.get(sprint_of(day)[0], "")

    rows, epic_ids, story_ids = [], {}, {}
    groups = [g for g in WBS if is_group(g[0]) and g[0] != MILESTONE_GROUP]
    for n, (gid, title, owner, start, due, _h, _s) in enumerate(groups):
        epic_ids[gid] = EPIC_ID_BASE + n
        desc = epic_description(gid, owner, start, due)
        rows.append(row(epic_ids[gid], "Epic", f"{gid}. {title}", description=desc, priority="High",
                        assignee=assignee, start=start, due=due, labels=[f"WBS-{gid}"]))

    subtasks_by_story = {}
    for t in WBS:
        if t[6]:
            subtasks_by_story.setdefault(t[6], []).append(t)
    for n, (us, epic, sp, prio, story, acs) in enumerate(USER_STORIES):
        story_ids[us] = STORY_ID_BASE + n
        subs = subtasks_by_story[us]
        start, due = min(s[3] for s in subs), max(s[4] for s in subs)
        desc = story + "\n\nAcceptance Criteria:\n" + "\n".join(f"AC{i}. {ac}" for i, ac in enumerate(acs, 1))
        rows.append(row(story_ids[us], "Story", f"{us} {US_TITLES[us]}", parent=epic_ids[epic],
                        description=desc, priority=prio, assignee=assignee, sprint=sprint_for(start), sp=sp,
                        start=start, due=due, labels=[us, sprint_label(start)]))

    next_id = ITEM_ID_BASE
    tasks, subtasks = [], []
    for tid, title, owner, start, due, hours, us in WBS:
        if is_group(tid):
            continue
        group = tid.split(".")[0]
        milestone = group == MILESTONE_GROUP
        continuous = tid in CONTINUOUS_TASKS
        labels = [owner, "milestone" if milestone else ("continuous" if continuous else sprint_label(start)),
                  f"WBS-{tid}"]
        prio = "High" if (tid in CRITICAL_PATH or milestone) else "Medium"
        desc = task_description(tid, owner, start, due, hours, us)
        summary = f"[{owner}] {tid} {title}"
        if us:
            subtasks.append(row(None, "Sub-task", summary, parent=story_ids[us], description=desc, priority=prio,
                                assignee=assignee, hours=hours, start=start, due=due, labels=labels))
        else:
            parent = epic_ids["1" if milestone else group]
            sprint = "" if continuous else sprint_for(start)
            tasks.append(row(None, "Task", summary, parent=parent, description=desc, priority=prio,
                             assignee=assignee, sprint=sprint, hours=hours, start=start, due=due, labels=labels))
    for r in tasks + subtasks:  # parents (Epic, Story, Task) before Sub-tasks
        r[0] = next_id
        next_id += 1
    return rows + tasks + subtasks


def sample(rows):
    """Epic 5 + US-01 + its 2 sub-tasks + 1 task: enough to prove every mapping."""
    epic = next(r for r in rows if r[1] == "Epic" and r[2].startswith("5."))
    story = next(r for r in rows if r[1] == "Story" and r[2].startswith("US-01"))
    subs = [r for r in rows if r[1] == "Sub-task" and r[3] == story[0]][:2]
    task = next(r for r in rows if r[1] == "Task" and r[3] == epic[0])
    return [epic, story, task] + subs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--sprint-ids", help="6 numeric IDs for Sprint 0..5, comma-separated")
    ap.add_argument("--assignee", default="", help="Atlassian account email to assign every item to")
    ap.add_argument("--sample", action="store_true", help="write only a 5-row smoke-test file")
    a = ap.parse_args()
    ids = [x.strip() for x in a.sprint_ids.split(",")] if a.sprint_ids else []
    if any(not x.isdigit() for x in ids):
        raise SystemExit("--sprint-ids must be numbers, e.g. 1,2,3,4,5,6 (Jira rejects sprint names)")
    rows = build_rows(ids, a.assignee)
    if a.sample:
        rows = sample(rows)
    with open(a.out, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        w.writerow(HEADER)
        w.writerows(rows)
    kinds = {}
    for r in rows:
        kinds[r[1]] = kinds.get(r[1], 0) + 1
    print(f"wrote {a.out}: {len(rows)} rows {kinds}; sprint column {'filled' if ids else 'EMPTY'}")


if __name__ == "__main__":
    main()
