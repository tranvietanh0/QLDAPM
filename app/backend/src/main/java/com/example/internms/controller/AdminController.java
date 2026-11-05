package com.example.internms.controller;
import com.example.internms.model.*;
import com.example.internms.repo.*;
import com.example.internms.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
@RestController @RequestMapping("/api/admin")
public class AdminController {
 private final UserRepository users;private final DepartmentRepository departments;private final InternProfileRepository interns;private final TaskRepository tasks;private final EvaluationRepository evaluations;private final AuthService auth;
 public AdminController(UserRepository u,DepartmentRepository d,InternProfileRepository i,TaskRepository t,EvaluationRepository e,AuthService a){users=u;departments=d;interns=i;tasks=t;evaluations=e;auth=a;}
 public record NamedRequest(String name){}
 public record MentorRequest(String name,String email,String password){}
 private String name(String s){if(s==null||s.isBlank()||s.length()>150) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Tên phải có 1–150 ký tự");return s.trim();}
 private String email(String s){if(s==null||!s.trim().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Email không hợp lệ");return s.trim().toLowerCase(Locale.ROOT);}
 @PostMapping("/departments") public Department addDept(@RequestHeader("Authorization") String h,@RequestBody NamedRequest r){auth.requireRole(h,Role.ADMIN);return departments.save(new Department(name(r.name())));}
 @PutMapping("/departments/{id}") public Department updateDept(@RequestHeader("Authorization") String h,@PathVariable Long id,@RequestBody NamedRequest r){auth.requireRole(h,Role.ADMIN);Department d=departments.findById(id).orElseThrow();d.setName(name(r.name()));return departments.save(d);}
 @DeleteMapping("/departments/{id}") public Map<String,String> deleteDept(@RequestHeader("Authorization") String h,@PathVariable Long id){auth.requireRole(h,Role.ADMIN);if(!interns.findByDepartmentId(id).isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Phòng ban đang có thực tập sinh");departments.deleteById(id);return Map.of("message","Đã xóa phòng ban");}
 @PostMapping("/mentors") public User addMentor(@RequestHeader("Authorization") String h,@RequestBody MentorRequest r){auth.requireRole(h,Role.ADMIN);String e=email(r.email());if(users.findByEmail(e).isPresent())throw new ResponseStatusException(HttpStatus.CONFLICT,"Email đã tồn tại");if(r.password()==null||r.password().length()<8||r.password().length()>72)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu phải có ít nhất 8 ký tự");return users.save(new User(name(r.name()),e,auth.hash(r.password()),Role.MENTOR));}
 @PutMapping("/mentors/{id}") public User updateMentor(@RequestHeader("Authorization") String h,@PathVariable Long id,@RequestBody MentorRequest r){auth.requireRole(h,Role.ADMIN);User m=users.findById(id).orElseThrow();if(m.getRole()!=Role.MENTOR)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Không phải mentor");String e=email(r.email());if(users.findByEmail(e).filter(u->!u.getId().equals(id)).isPresent())throw new ResponseStatusException(HttpStatus.CONFLICT,"Email đã tồn tại");m.setName(name(r.name()));m.setEmail(e);if(r.password()!=null&&!r.password().isBlank()){if(r.password().length()<8||r.password().length()>72)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu phải có ít nhất 8 ký tự");m.setPassword(auth.hash(r.password()));auth.revokeUser(id);}return users.save(m);}
 @DeleteMapping("/mentors/{id}") @Transactional public Map<String,String> deleteMentor(@RequestHeader("Authorization") String h,@PathVariable Long id){auth.requireRole(h,Role.ADMIN);User m=users.findById(id).orElseThrow();if(m.getRole()!=Role.MENTOR)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Không phải mentor");if(!tasks.findByMentorId(id).isEmpty()||!evaluations.findByMentorId(id).isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"Mentor vẫn có công việc hoặc đánh giá; hãy chuyển người hướng dẫn trong hồ sơ trước");if(!interns.findByMentorId(id).isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"Mentor đang hướng dẫn thực tập sinh");auth.revokeUser(id);users.delete(m);return Map.of("message","Đã xóa mentor");}
}
