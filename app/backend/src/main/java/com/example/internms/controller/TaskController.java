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
@RestController @RequestMapping("/api/tasks")
public class TaskController {
 private final TaskRepository tasks;private final InternProfileRepository interns;private final AuthService auth;
 public TaskController(TaskRepository t,InternProfileRepository i,AuthService a){tasks=t;interns=i;auth=a;}
 public record TaskRequest(Long internId,String title,String description,String priority,LocalDate deadline){}
 public record StatusRequest(TaskStatus status,String completionNote){}
 @GetMapping public List<TaskItem> list(@RequestHeader("Authorization") String h){
  User u=auth.requireUser(h);if(u.getRole()==Role.ADMIN)return tasks.findAll();if(u.getRole()==Role.MENTOR)return tasks.findByMentorId(u.getId());
  return interns.findByUserId(u.getId()).map(i->tasks.findByInternId(i.getId())).orElse(List.of());
 }
 @GetMapping("/my-tasks") public List<TaskItem> my(@RequestHeader("Authorization") String h){User u=auth.requireRole(h,Role.INTERN);return interns.findByUserId(u.getId()).map(i->tasks.findByInternId(i.getId())).orElse(List.of());}
 private String priority(String val){String s=val==null?"MEDIUM":val;if(!List.of("LOW","MEDIUM","HIGH").contains(s))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mức ưu tiên không hợp lệ");return s;}
 private void fields(TaskRequest r,InternProfile i){if(r.description()!=null&&r.description().length()>2000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mô tả vượt quá 2000 ký tự");if(r.title()==null||r.title().isBlank()||r.title().length()>255)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Tiêu đề không hợp lệ");if(r.deadline()==null||r.deadline().isBefore(i.getStartDate())||r.deadline().isAfter(i.getEndDate()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Hạn công việc phải thuộc kỳ thực tập");priority(r.priority());}
 private void ownership(User m,InternProfile p){if(m.getRole()!=Role.ADMIN&&!p.getMentor().getId().equals(m.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Thực tập sinh không thuộc mentor này");}
 @PostMapping @Transactional public TaskItem create(@RequestHeader("Authorization") String h,@RequestBody TaskRequest r){
  User m=auth.requireRole(h,Role.ADMIN,Role.MENTOR);if(r.internId()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cần chọn thực tập sinh");InternProfile i=interns.findById(r.internId()).orElseThrow();ownership(m,i);fields(r,i);
  TaskItem t=new TaskItem();t.setTitle(r.title().trim());t.setDescription(r.description());t.setPriority(priority(r.priority()));t.setDeadline(r.deadline());t.setIntern(i);t.setMentor(i.getMentor());TaskItem saved=tasks.save(t);progress(i);return saved;
 }
 @PutMapping("/{id}") @Transactional public TaskItem update(@RequestHeader("Authorization") String h,@PathVariable Long id,@RequestBody TaskRequest r){
  User m=auth.requireRole(h,Role.ADMIN,Role.MENTOR);TaskItem t=tasks.findById(id).orElseThrow();if(m.getRole()!=Role.ADMIN&&!t.getMentor().getId().equals(m.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền sửa công việc");
  InternProfile old=t.getIntern();InternProfile target=r.internId()==null?old:interns.findById(r.internId()).orElseThrow();ownership(m,target);
  fields(r,target);t.setTitle(r.title().trim());t.setDescription(r.description());t.setPriority(priority(r.priority()));t.setDeadline(r.deadline());t.setIntern(target);t.setMentor(target.getMentor());
  TaskItem saved=tasks.save(t);progress(old);if(!old.getId().equals(target.getId()))progress(target);return saved;
 }
 @DeleteMapping("/{id}") @Transactional public Map<String,String> delete(@RequestHeader("Authorization") String h,@PathVariable Long id){
  User me=auth.requireUser(h);TaskItem t=tasks.findById(id).orElseThrow();if(me.getRole()!=Role.ADMIN&&(me.getRole()!=Role.MENTOR||!t.getMentor().getId().equals(me.getId())))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền xóa công việc");
  InternProfile i=t.getIntern();tasks.delete(t);tasks.flush();progress(i);return Map.of("message","Đã xóa công việc");
 }
 @PutMapping("/{id}/status") @Transactional public TaskItem status(@RequestHeader("Authorization") String h,@PathVariable Long id,@RequestBody StatusRequest r){
  User u=auth.requireRole(h,Role.INTERN);InternProfile i=interns.findByUserId(u.getId()).orElseThrow();TaskItem t=tasks.findById(id).orElseThrow();
  if(!t.getIntern().getId().equals(i.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không phải công việc của bạn");
  if(r.status()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Thiếu trạng thái");
  boolean ok=(t.getStatus()==TaskStatus.TODO&&r.status()==TaskStatus.IN_PROGRESS)||(t.getStatus()==TaskStatus.IN_PROGRESS&&r.status()==TaskStatus.COMPLETED)||t.getStatus()==r.status();
  if(!ok)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Không thể chuyển trực tiếp trạng thái này");
  t.setStatus(r.status());t.setCompletionNote(r.completionNote());TaskItem saved=tasks.save(t);progress(i);return saved;
 }
 private void progress(InternProfile i){List<TaskItem> all=tasks.findByInternId(i.getId());long done=all.stream().filter(t->t.getStatus()==TaskStatus.COMPLETED).count();i.setProgress(all.isEmpty()?0:(int)Math.round(done*100.0/all.size()));interns.save(i);}
}
