package com.example.internms.controller;
import com.example.internms.model.*;
import com.example.internms.repo.*;
import com.example.internms.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
@RestController @RequestMapping("/api/evaluations")
public class EvaluationController {
 private final EvaluationRepository evaluations;private final InternProfileRepository interns;private final AuthService auth;
 public EvaluationController(EvaluationRepository e,InternProfileRepository i,AuthService a){evaluations=e;interns=i;auth=a;}
 public record EvaluationRequest(Long internId,double technicalSkill,double communication,double teamwork,double responsibility,String comment){}
 @GetMapping public List<Evaluation> list(@RequestHeader("Authorization") String h){
  User me=auth.requireUser(h);if(me.getRole()==Role.ADMIN)return evaluations.findAll();if(me.getRole()==Role.MENTOR)return evaluations.findByMentorId(me.getId());
  return interns.findByUserId(me.getId()).flatMap(p->evaluations.findByInternId(p.getId())).map(List::of).orElse(List.of());
 }
 @PostMapping public Evaluation create(@RequestHeader("Authorization") String h,@RequestBody EvaluationRequest r){
  User m=auth.requireRole(h,Role.ADMIN,Role.MENTOR);if(r.internId()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cần chọn thực tập sinh");InternProfile i=interns.findById(r.internId()).orElseThrow();
  if(m.getRole()!=Role.ADMIN&&!i.getMentor().getId().equals(m.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Thực tập sinh không thuộc mentor này");
  check(r.technicalSkill());check(r.communication());check(r.teamwork());check(r.responsibility());if(r.comment()!=null&&r.comment().length()>3000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Nhận xét vượt quá 3000 ký tự");
  Evaluation e=evaluations.findByInternId(i.getId()).orElse(new Evaluation());e.setIntern(i);e.setMentor(i.getMentor());e.setTechnicalSkill(r.technicalSkill());e.setCommunication(r.communication());e.setTeamwork(r.teamwork());e.setResponsibility(r.responsibility());e.setOverallScore((r.technicalSkill()+r.communication()+r.teamwork()+r.responsibility())/4);e.setComment(r.comment());return evaluations.save(e);
 }
 @GetMapping("/{internId}") public Evaluation get(@RequestHeader("Authorization") String h,@PathVariable Long internId){
  User me=auth.requireUser(h);InternProfile i=interns.findById(internId).orElseThrow();
  if(me.getRole()==Role.INTERN&&!i.getUser().getId().equals(me.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền xem đánh giá");
  if(me.getRole()==Role.MENTOR&&!i.getMentor().getId().equals(me.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền xem đánh giá");
  return evaluations.findByInternId(internId).orElseThrow();
 }
 private void check(double s){if(!Double.isFinite(s)||s<0||s>10)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Điểm phải từ 0 đến 10");}
}
