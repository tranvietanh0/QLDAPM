package com.example.internms.controller;
import com.example.internms.model.*;
import com.example.internms.repo.*;
import com.example.internms.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
@RestController @RequestMapping("/api/reports")
public class ReportController {
 private final WeeklyReportRepository reports;private final InternProfileRepository interns;private final AuthService auth;
 public ReportController(WeeklyReportRepository r,InternProfileRepository i,AuthService a){reports=r;interns=i;auth=a;}
 public record SubmitReport(int weekNumber,String completedWork,String learned,String problems,String planNextWeek){}
 public record ReviewReport(String mentorComment,double rating){}
 @GetMapping public List<WeeklyReport> list(@RequestHeader("Authorization") String h){
  User me=auth.requireUser(h);if(me.getRole()==Role.ADMIN)return reports.findAll();
  if(me.getRole()==Role.INTERN)return interns.findByUserId(me.getId()).map(i->reports.findByInternId(i.getId())).orElse(List.of());
  List<WeeklyReport> out=new ArrayList<>();for(InternProfile i:interns.findByMentorId(me.getId()))out.addAll(reports.findByInternId(i.getId()));return out;
 }
 private void fields(SubmitReport r){if(Arrays.asList(r.completedWork(),r.learned(),r.problems(),r.planNextWeek()).stream().anyMatch(x->x!=null&&x.length()>3000))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Nội dung báo cáo vượt quá 3000 ký tự");if(r.weekNumber()<1||r.weekNumber()>53)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Tuần phải từ 1 đến 53");if(r.completedWork()==null||r.completedWork().isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Nội dung công việc không được để trống");}
 private void apply(WeeklyReport w,SubmitReport r){w.setCompletedWork(r.completedWork());w.setLearned(r.learned());w.setProblems(r.problems());w.setPlanNextWeek(r.planNextWeek());}
 @PostMapping public WeeklyReport submit(@RequestHeader("Authorization") String h,@RequestBody SubmitReport r){
  User u=auth.requireRole(h,Role.INTERN);InternProfile i=interns.findByUserId(u.getId()).orElseThrow();fields(r);
  if(reports.findByInternIdAndWeekNumber(i.getId(),r.weekNumber()).isPresent())throw new ResponseStatusException(HttpStatus.CONFLICT,"Tuần này đã có báo cáo");
  WeeklyReport w=new WeeklyReport();w.setIntern(i);w.setWeekNumber(r.weekNumber());apply(w,r);return reports.save(w);
 }
 @PutMapping("/{id}") public WeeklyReport edit(@RequestHeader("Authorization") String h,@PathVariable Long id,@RequestBody SubmitReport r){
  User me=auth.requireRole(h,Role.INTERN);WeeklyReport w=reports.findById(id).orElseThrow();if(!w.getIntern().getUser().getId().equals(me.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không phải báo cáo của bạn");
  if(w.getStatus()==ReportStatus.REVIEWED)throw new ResponseStatusException(HttpStatus.CONFLICT,"Báo cáo đã đánh giá không thể sửa");fields(r);
  if(w.getWeekNumber()!=r.weekNumber()&&reports.findByInternIdAndWeekNumber(w.getIntern().getId(),r.weekNumber()).isPresent())throw new ResponseStatusException(HttpStatus.CONFLICT,"Tuần này đã có báo cáo");
  w.setWeekNumber(r.weekNumber());apply(w,r);return reports.save(w);
 }
 @DeleteMapping("/{id}") public Map<String,String> delete(@RequestHeader("Authorization") String h,@PathVariable Long id){
  User me=auth.requireUser(h);WeeklyReport w=reports.findById(id).orElseThrow();
  if(me.getRole()!=Role.ADMIN&&(me.getRole()!=Role.INTERN||!w.getIntern().getUser().getId().equals(me.getId())))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền xóa báo cáo");
  if(me.getRole()==Role.INTERN&&w.getStatus()==ReportStatus.REVIEWED)throw new ResponseStatusException(HttpStatus.CONFLICT,"Báo cáo đã đánh giá không thể xóa");
  reports.delete(w);return Map.of("message","Đã xóa báo cáo");
 }
 @PutMapping("/{id}/review") public WeeklyReport review(@RequestHeader("Authorization") String h,@PathVariable Long id,@RequestBody ReviewReport r){
  User m=auth.requireRole(h,Role.ADMIN,Role.MENTOR);WeeklyReport w=reports.findById(id).orElseThrow();
  if(m.getRole()!=Role.ADMIN&&!w.getIntern().getMentor().getId().equals(m.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không được đánh giá báo cáo này");
  if(!Double.isFinite(r.rating())||r.rating()<0||r.rating()>10)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Điểm phải từ 0 đến 10");
  if(r.mentorComment()!=null&&r.mentorComment().length()>3000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Nhận xét vượt quá 3000 ký tự");
  w.setMentorComment(r.mentorComment());w.setRating(r.rating());w.setStatus(ReportStatus.REVIEWED);return reports.save(w);
 }
}
