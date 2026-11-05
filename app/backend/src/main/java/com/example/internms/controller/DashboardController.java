package com.example.internms.controller;

import com.example.internms.model.*;
import com.example.internms.repo.*;
import com.example.internms.service.AuthService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/dashboard")
public class DashboardController {
    private final InternProfileRepository interns;
    private final UserRepository users;
    private final TaskRepository tasks;
    private final WeeklyReportRepository reports;
    private final AuthService auth;
    public DashboardController(InternProfileRepository i, UserRepository u, TaskRepository t, WeeklyReportRepository r, AuthService a) {
        interns=i; users=u; tasks=t; reports=r; auth=a;
    }
    @GetMapping("/statistics")
    public Map<String,Object> stats(@RequestHeader(value="Authorization",required=false) String h) {
        User me=auth.requireUser(h);
        List<InternProfile> profiles=switch(me.getRole()) {
            case ADMIN -> interns.findAll();
            case MENTOR -> interns.findByMentorId(me.getId());
            case INTERN -> interns.findByUserId(me.getId()).map(List::of).orElse(List.of());
        };
        List<TaskItem> scopedTasks=me.getRole()==Role.ADMIN?tasks.findAll():
            me.getRole()==Role.MENTOR?tasks.findByMentorId(me.getId()):
            profiles.stream().flatMap(p->tasks.findByInternId(p.getId()).stream()).toList();
        long reportCount=me.getRole()==Role.ADMIN?reports.count():
            profiles.stream().mapToLong(p->reports.findByInternId(p.getId()).size()).sum();
        return Map.of(
            "interns", profiles.size(),
            "mentors", me.getRole()==Role.ADMIN?users.findByRole(Role.MENTOR).size():profiles.stream().map(p->p.getMentor().getId()).distinct().count(),
            "tasksTodo", scopedTasks.stream().filter(t->t.getStatus()==TaskStatus.TODO).count(),
            "tasksInProgress", scopedTasks.stream().filter(t->t.getStatus()==TaskStatus.IN_PROGRESS).count(),
            "tasksCompleted", scopedTasks.stream().filter(t->t.getStatus()==TaskStatus.COMPLETED).count(),
            "reports", reportCount
        );
    }
}
