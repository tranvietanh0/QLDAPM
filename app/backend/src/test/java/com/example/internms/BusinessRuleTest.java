package com.example.internms;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest(properties={
 "spring.datasource.url=jdbc:h2:mem:business_rules;MODE=MySQL;DB_CLOSE_DELAY=-1",
 "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class BusinessRuleTest {
 private static final String PASSWORD="Password123";
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper json;

 private record Account(long userId,String token){}
 private record Intern(long profileId,Account account){}

 private JsonNode send(MockHttpServletRequestBuilder request,String token,Object body,int expectedStatus) throws Exception{
  if(token!=null)request.header("Authorization","Bearer "+token);
  if(body!=null)request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
  MvcResult result=mvc.perform(request).andReturn();
  String content=result.getResponse().getContentAsString();
  assertEquals(expectedStatus,result.getResponse().getStatus(),"Unexpected response body: "+content);
  return content.isBlank()?json.nullNode():json.readTree(content);
 }

 private static String uniqueEmail(String prefix){return prefix+"-"+UUID.randomUUID().toString().substring(0,8)+"@test.vn";}
 private static String uniqueName(String prefix){return prefix+" "+UUID.randomUUID().toString().substring(0,8);}

 private String adminToken() throws Exception{
  return send(post("/api/auth/login"),null,Map.of("email","admin@gmail.com","password","123456"),200).get("token").asText();
 }
 private String login(String email) throws Exception{
  return send(post("/api/auth/login"),null,Map.of("email",email,"password",PASSWORD),200).get("token").asText();
 }
 private long createDepartment(String admin) throws Exception{
  return send(post("/api/admin/departments"),admin,Map.of("name",uniqueName("BR dept")),200).get("id").asLong();
 }
 private Account createMentor(String admin) throws Exception{
  String email=uniqueEmail("mentor");
  long id=send(post("/api/admin/mentors"),admin,Map.of("name","BR mentor","email",email,"password",PASSWORD),200).get("id").asLong();
  return new Account(id,login(email));
 }
 private Map<String,Object> internBody(String email,long deptId,long mentorUserId,String start,String end){
  return Map.of("name","BR intern","email",email,"password",PASSWORD,"departmentId",deptId,
   "mentorId",mentorUserId,"startDate",start,"endDate",end,"status","ACTIVE");
 }
 private Intern createIntern(String admin,long deptId,long mentorUserId,String start,String end) throws Exception{
  String email=uniqueEmail("intern");
  JsonNode profile=send(post("/api/interns"),admin,internBody(email,deptId,mentorUserId,start,end),200);
  return new Intern(profile.get("id").asLong(),new Account(profile.get("user").get("id").asLong(),login(email)));
 }
 private Map<String,Object> taskBody(long internProfileId,String deadline){
  return Map.of("internId",internProfileId,"title","BR task","priority","HIGH","deadline",deadline);
 }
 private long submitReport(Account intern,int week) throws Exception{
  return send(post("/api/reports"),intern.token(),Map.of("weekNumber",week,"completedWork","Week "+week),200).get("id").asLong();
 }
 private Map<String,Object> evaluationBody(long internProfileId,double technical,double communication,double teamwork,double responsibility){
  return Map.of("internId",internProfileId,"technicalSkill",technical,"communication",communication,
   "teamwork",teamwork,"responsibility",responsibility);
 }

 @Test void duplicateInternEmailIsRejectedCaseInsensitively() throws Exception{
  String admin=adminToken();
  long dept=createDepartment(admin);
  long mentor=createMentor(admin).userId();
  String email=uniqueEmail("dup");
  send(post("/api/interns"),admin,internBody(email,dept,mentor,"2026-09-01","2027-06-30"),200);
  send(post("/api/interns"),admin,internBody(email,dept,mentor,"2026-09-01","2027-06-30"),409);
  send(post("/api/interns"),admin,internBody(email.toUpperCase(),dept,mentor,"2026-09-01","2027-06-30"),409);
 }

 @Test void internEndDateNotAfterStartDateIsRejected() throws Exception{
  String admin=adminToken();
  long dept=createDepartment(admin);
  long mentor=createMentor(admin).userId();
  String email=uniqueEmail("dates");
  send(post("/api/interns"),admin,internBody(email,dept,mentor,"2026-09-01","2026-09-01"),400);
  send(post("/api/interns"),admin,internBody(email,dept,mentor,"2026-09-01","2026-08-31"),400);
  // A rejected request must not reserve the email: the same email with valid dates is accepted.
  send(post("/api/interns"),admin,internBody(email,dept,mentor,"2026-09-01","2026-09-02"),200);
 }

 @Test void taskDeadlineOutsideInternshipIsRejected() throws Exception{
  String admin=adminToken();
  Account mentor=createMentor(admin);
  Intern intern=createIntern(admin,createDepartment(admin),mentor.userId(),"2026-09-01","2027-06-30");
  send(post("/api/tasks"),mentor.token(),taskBody(intern.profileId(),"2026-08-31"),400);
  send(post("/api/tasks"),mentor.token(),taskBody(intern.profileId(),"2027-07-01"),400);
  // Boundary dates of the internship period are inclusive.
  send(post("/api/tasks"),mentor.token(),taskBody(intern.profileId(),"2026-09-01"),200);
  send(post("/api/tasks"),mentor.token(),taskBody(intern.profileId(),"2027-06-30"),200);
 }

 @Test void internCannotMoveTaskFromTodoDirectlyToCompleted() throws Exception{
  String admin=adminToken();
  Account mentor=createMentor(admin);
  Intern intern=createIntern(admin,createDepartment(admin),mentor.userId(),"2026-09-01","2027-06-30");
  long taskId=send(post("/api/tasks"),mentor.token(),taskBody(intern.profileId(),"2026-12-01"),200).get("id").asLong();
  send(put("/api/tasks/{id}/status",taskId),intern.account().token(),Map.of("status","COMPLETED","completionNote","Skipped"),400);
  JsonNode mine=send(get("/api/tasks/my-tasks"),intern.account().token(),null,200);
  assertEquals(1,mine.size());
  assertEquals("TODO",mine.get(0).get("status").asText(),"Rejected transition must leave the task in TODO");
  // Control: the documented sequence TODO -> IN_PROGRESS -> COMPLETED still works on the same task.
  send(put("/api/tasks/{id}/status",taskId),intern.account().token(),Map.of("status","IN_PROGRESS"),200);
  send(put("/api/tasks/{id}/status",taskId),intern.account().token(),Map.of("status","COMPLETED","completionNote","Done"),200);
 }

 @Test void secondWeeklyReportForSameWeekIsRejected() throws Exception{
  String admin=adminToken();
  Account mentor=createMentor(admin);
  Intern intern=createIntern(admin,createDepartment(admin),mentor.userId(),"2026-09-01","2027-06-30");
  String token=intern.account().token();
  send(post("/api/reports"),token,Map.of("weekNumber",12,"completedWork","First submission"),200);
  send(post("/api/reports"),token,Map.of("weekNumber",12,"completedWork","Duplicate submission"),409);
  JsonNode mine=send(get("/api/reports"),token,null,200);
  assertEquals(1,mine.size());
  assertEquals("First submission",mine.get(0).get("completedWork").asText());
  // Control: a different week number is still accepted.
  send(post("/api/reports"),token,Map.of("weekNumber",13,"completedWork","Next week"),200);
 }

 @Test void mentorReportRatingOutsideZeroToTenIsRejected() throws Exception{
  String admin=adminToken();
  Account mentor=createMentor(admin);
  Intern intern=createIntern(admin,createDepartment(admin),mentor.userId(),"2026-09-01","2027-06-30");
  long reportId=submitReport(intern.account(),5);
  send(put("/api/reports/{id}/review",reportId),mentor.token(),Map.of("rating",11,"mentorComment","Too high"),400);
  send(put("/api/reports/{id}/review",reportId),mentor.token(),Map.of("rating",-1,"mentorComment","Too low"),400);
  JsonNode stillSubmitted=send(get("/api/reports"),intern.account().token(),null,200);
  assertEquals("SUBMITTED",stillSubmitted.get(0).get("status").asText(),"Rejected rating must not change the report status");
  // Boundary: 10 is inside the allowed range.
  JsonNode reviewed=send(put("/api/reports/{id}/review",reportId),mentor.token(),Map.of("rating",10,"mentorComment","Excellent"),200);
  assertEquals("REVIEWED",reviewed.get("status").asText());
 }

 @Test void evaluationScoreOutsideZeroToTenIsRejected() throws Exception{
  String admin=adminToken();
  Account mentor=createMentor(admin);
  Intern intern=createIntern(admin,createDepartment(admin),mentor.userId(),"2026-09-01","2027-06-30");
  long id=intern.profileId();
  send(post("/api/evaluations"),mentor.token(),evaluationBody(id,11,8,8,9),400);
  send(post("/api/evaluations"),mentor.token(),evaluationBody(id,9,-1,8,9),400);
  send(post("/api/evaluations"),mentor.token(),evaluationBody(id,9,8,8,10.5),400);
  assertEquals(0,send(get("/api/evaluations"),mentor.token(),null,200).size(),"Rejected evaluations must not be stored");
  // Boundary: 0 and 10 are inside the allowed range; overall is the average of the four scores.
  JsonNode accepted=send(post("/api/evaluations"),mentor.token(),evaluationBody(id,0,10,0,10),200);
  assertEquals(5.0,accepted.get("overallScore").asDouble(),0.0001);
 }

 @Test void internCannotReadAnotherInternsEvaluation() throws Exception{
  String admin=adminToken();
  Account mentor=createMentor(admin);
  long dept=createDepartment(admin);
  Intern owner=createIntern(admin,dept,mentor.userId(),"2026-09-01","2027-06-30");
  Intern other=createIntern(admin,dept,mentor.userId(),"2026-09-01","2027-06-30");
  send(post("/api/evaluations"),mentor.token(),evaluationBody(owner.profileId(),8,8,8,8),200);
  send(get("/api/evaluations/{internId}",owner.profileId()),other.account().token(),null,403);
  // Control: the owning intern can read their own evaluation.
  JsonNode own=send(get("/api/evaluations/{internId}",owner.profileId()),owner.account().token(),null,200);
  assertEquals(8.0,own.get("overallScore").asDouble(),0.0001);
 }
}
