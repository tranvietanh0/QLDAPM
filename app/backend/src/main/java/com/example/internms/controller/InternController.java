package com.example.internms.controller;
import com.example.internms.model.*;
import com.example.internms.repo.*;
import com.example.internms.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.*;
@RestController @RequestMapping("/api/interns")
public class InternController {
 private final InternProfileRepository interns;private final UserRepository users;private final DepartmentRepository depts;private final AuthService auth;
 private final TaskRepository tasks;private final WeeklyReportRepository reports;private final EvaluationRepository evaluations;
 public InternController(InternProfileRepository i,UserRepository u,DepartmentRepository d,AuthService a,TaskRepository t,WeeklyReportRepository r,EvaluationRepository e){interns=i;users=u;depts=d;auth=a;tasks=t;reports=r;evaluations=e;}
 public record InternRequest(String name,String email,String password,Long departmentId,Long mentorId,LocalDate startDate,LocalDate endDate,String status){}
 @GetMapping public List<InternProfile> list(@RequestHeader("Authorization") String h){
  User me=auth.requireUser(h);
  if(me.getRole()==Role.MENTOR)return interns.findByMentorId(me.getId());
  if(me.getRole()==Role.INTERN)return interns.findByUserId(me.getId()).map(List::of).orElse(List.of());
  return interns.findAll();
 }
 @GetMapping("/{id}") public InternProfile one(@RequestHeader("Authorization") String h,@PathVariable Long id){
  User me=auth.requireUser(h);InternProfile prof=interns.findById(id).orElseThrow();
  if(me.getRole()==Role.INTERN&&!prof.getUser().getId().equals(me.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền xem hồ sơ");
  if(me.getRole()==Role.MENTOR&&!prof.getMentor().getId().equals(me.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền xem hồ sơ");
  return prof;
 }
 private String name(String val){if(val==null||val.isBlank()||val.trim().length()>150)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Họ tên không hợp lệ");return val.trim();}
 private String email(String val){if(val==null||!val.trim().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Email không hợp lệ");return val.trim().toLowerCase(Locale.ROOT);}
 private void dates(LocalDate s,LocalDate e){if(s==null||e==null||!e.isAfter(s))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ngày kết thúc phải sau ngày bắt đầu");}
 private User mentor(Long id){if(id==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Vui lòng chọn mentor");User u=users.findById(id).orElseThrow();if(u.getRole()!=Role.MENTOR)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Vui lòng chọn mentor");return u;}
 private String status(String value){if(value==null||value.isBlank())return "ACTIVE";if(!List.of("ACTIVE","COMPLETED","STOPPED").contains(value))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Trạng thái không hợp lệ");return value;}
 @PostMapping @Transactional public InternProfile create(@RequestHeader("Authorization") String h,@RequestBody InternRequest r){
  auth.requireRole(h,Role.ADMIN);dates(r.startDate(),r.endDate());String e=email(r.email());
  if(users.findByEmail(e).isPresent())throw new ResponseStatusException(HttpStatus.CONFLICT,"Email đã tồn tại");
  if(r.password()==null||r.password().length()<8||r.password().length()>72)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu phải có ít nhất 8 ký tự");
  if(r.departmentId()==null||r.mentorId()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cần chọn phòng ban và người hướng dẫn");
  Department d=depts.findById(r.departmentId()).orElseThrow();User m=mentor(r.mentorId());
  User u=users.save(new User(name(r.name()),e,auth.hash(r.password()),Role.INTERN));
  InternProfile prof=new InternProfile();prof.setUser(u);prof.setDepartment(d);prof.setMentor(m);prof.setStartDate(r.startDate());prof.setEndDate(r.endDate());prof.setStatus(status(r.status()));return interns.save(prof);
 }
 @PutMapping("/{id}") @Transactional public InternProfile update(@RequestHeader("Authorization") String h,@PathVariable Long id,@RequestBody InternRequest r){
  auth.requireRole(h,Role.ADMIN);InternProfile prof=interns.findById(id).orElseThrow();
  LocalDate start=r.startDate()==null?prof.getStartDate():r.startDate();LocalDate end=r.endDate()==null?prof.getEndDate():r.endDate();dates(start,end);
  if(r.name()!=null)prof.getUser().setName(name(r.name()));
  if(r.email()!=null){String e=email(r.email());if(users.findByEmail(e).filter(u->!u.getId().equals(prof.getUser().getId())).isPresent())throw new ResponseStatusException(HttpStatus.CONFLICT,"Email đã tồn tại");prof.getUser().setEmail(e);}
  if(r.password()!=null&&!r.password().isBlank()){if(r.password().length()<8||r.password().length()>72)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu phải có ít nhất 8 ký tự");prof.getUser().setPassword(auth.hash(r.password()));auth.revokeUser(prof.getUser().getId());}
  if(r.departmentId()!=null)prof.setDepartment(depts.findById(r.departmentId()).orElseThrow());
  if(r.mentorId()!=null){
   User next=mentor(r.mentorId());
   if(!next.getId().equals(prof.getMentor().getId())){
    // Giữ quyền xem/chấm công việc và đánh giá khi đổi người hướng dẫn.
    for(TaskItem t:tasks.findByInternId(id)){t.setMentor(next);tasks.save(t);}
    evaluations.findByInternId(id).ifPresent(ev->{ev.setMentor(next);evaluations.save(ev);});
    prof.setMentor(next);
   }
  }
  if(r.status()!=null)prof.setStatus(status(r.status()));
  prof.setStartDate(start);prof.setEndDate(end);users.save(prof.getUser());return interns.save(prof);
 }
 @DeleteMapping("/{id}") @Transactional public Map<String,String> delete(@RequestHeader("Authorization") String h,@PathVariable Long id){
  auth.requireRole(h,Role.ADMIN);InternProfile prof=interns.findById(id).orElseThrow();
  evaluations.findByInternId(id).ifPresent(evaluations::delete);
  reports.deleteAll(reports.findByInternId(id));tasks.deleteAll(tasks.findByInternId(id));
  interns.delete(prof);interns.flush();auth.revokeUser(prof.getUser().getId());users.delete(prof.getUser());
  return Map.of("message","Đã xóa hồ sơ và dữ liệu liên quan");
 }
}
