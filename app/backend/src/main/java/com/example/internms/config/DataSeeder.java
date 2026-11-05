package com.example.internms.config;

import com.example.internms.model.*;
import com.example.internms.repo.*;
import com.example.internms.service.AuthService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.LocalDate;

@Configuration
public class DataSeeder {
    @Bean CommandLineRunner seed(UserRepository users, DepartmentRepository departments, InternProfileRepository interns, TaskRepository tasks, AuthService auth){
        return args -> {
            if(users.count()>0) return;
            Department it=departments.save(new Department("IT"));
            departments.save(new Department("Marketing"));
            User admin=users.save(new User("Admin HR","admin@gmail.com",auth.hash("123456"),Role.ADMIN));
            User mentor=users.save(new User("Tran Van Binh","mentor@gmail.com",auth.hash("123456"),Role.MENTOR));
            User internUser=users.save(new User("Nguyen Van An","intern@gmail.com",auth.hash("123456"),Role.INTERN));
            InternProfile p=new InternProfile(); p.setUser(internUser); p.setDepartment(it); p.setMentor(mentor);
            p.setStartDate(LocalDate.of(2026,9,1)); p.setEndDate(LocalDate.of(2027,6,30)); p.setProgress(0);
            p=interns.save(p);
            TaskItem t=new TaskItem(); t.setTitle("Thiet ke man hinh Login"); t.setDescription("Tao giao dien login va ket noi API");
            t.setPriority("HIGH"); t.setDeadline(LocalDate.of(2026,12,30)); t.setIntern(p); t.setMentor(mentor); tasks.save(t);
        };
    }
}
