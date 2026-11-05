package com.example.internms.controller;

import com.example.internms.model.*;
import com.example.internms.repo.*;
import com.example.internms.service.AuthService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api")
public class MetaController {
    private final UserRepository users; private final DepartmentRepository depts; private final AuthService auth;
    public MetaController(UserRepository u,DepartmentRepository d,AuthService a){users=u;depts=d;auth=a;}
    @GetMapping("/mentors") public List<User> mentors(@RequestHeader(value="Authorization",required=false) String h){auth.requireUser(h); return users.findByRole(Role.MENTOR);}
    @GetMapping("/departments") public List<Department> departments(@RequestHeader(value="Authorization",required=false) String h){auth.requireUser(h); return depts.findAll();}
}
