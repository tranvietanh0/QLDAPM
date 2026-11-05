package com.example.internms;

import com.example.internms.repo.UserSessionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={
 "spring.datasource.url=jdbc:h2:mem:admin_intern_flow;MODE=MySQL;DB_CLOSE_DELAY=-1",
 "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class AdminInternFlowTest {
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper json;
 @Autowired UserSessionRepository sessions;
 private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request,String token) {
  return request.header("Authorization","Bearer "+token);
 }
 private JsonNode ok(MockHttpServletRequestBuilder request,Object body) throws Exception {
  if(body!=null)request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
  return json.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
 }
 private String login(String portal,String email,String password) throws Exception {
  return ok(post("/api/auth/"+portal+"/login"),Map.of("email",email,"password",password)).get("token").asText();
 }
 @Test void adminCreatesAccountAssignsWorkAndReviewsInternReport() throws Exception {
  long before=sessions.count();
  mvc.perform(post("/api/auth/admin/login").contentType(MediaType.APPLICATION_JSON)
   .content(json.writeValueAsString(Map.of("email","intern@gmail.com","password","123456")))).andExpect(status().isForbidden());
  mvc.perform(post("/api/auth/intern/login").contentType(MediaType.APPLICATION_JSON)
   .content(json.writeValueAsString(Map.of("email","admin@gmail.com","password","123456")))).andExpect(status().isForbidden());
  assertEquals(before,sessions.count(),"Wrong portal login must not mint a session");
  String admin=login("admin","admin@gmail.com","123456");
  String outsider=login("intern","intern@gmail.com","123456");
  String oldMentor=ok(post("/api/auth/login"),Map.of("email","mentor@gmail.com","password","123456")).get("token").asText();
  JsonNode dept=ok(as(get("/api/departments"),admin),null).get(0);
  JsonNode mentor=ok(as(post("/api/admin/mentors"),admin),Map.of("name","Flow mentor","email","flow.mentor@test.vn","password","Password123"));
  JsonNode profile=ok(as(post("/api/interns"),admin),Map.of(
   "name","Flow intern","email","flow.intern@test.vn","password","Password123",
   "departmentId",dept.get("id").asLong(),"mentorId",mentor.get("id").asLong(),
   "startDate","2026-09-01","endDate","2027-06-30","status","ACTIVE"));
  long internId=profile.get("id").asLong();
  String intern=login("intern","flow.intern@test.vn","Password123");
  Map<String,Object> work=Map.of("internId",internId,"title","Admin assigns work","description","Implement feature","priority","HIGH","deadline","2026-12-01");
  mvc.perform(as(post("/api/tasks"),oldMentor).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(work))).andExpect(status().isForbidden());
  JsonNode task=ok(as(post("/api/tasks"),admin),work);
  long taskId=task.get("id").asLong();
  assertEquals(mentor.get("id").asLong(),task.get("mentor").get("id").asLong());
  Map<String,Object> updated=Map.of("internId",internId,"title","Admin updates work","priority","HIGH","deadline","2026-12-02");
  ok(as(put("/api/tasks/"+taskId),admin),updated);
  mvc.perform(as(post("/api/tasks"),intern).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(work))).andExpect(status().isForbidden());
  mvc.perform(as(post("/api/interns"),intern).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
  mvc.perform(as(put("/api/tasks/"+taskId+"/status"),outsider).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}")).andExpect(status().isForbidden());
  mvc.perform(as(get("/api/interns/"+internId),outsider)).andExpect(status().isForbidden());
  ok(as(put("/api/tasks/"+taskId+"/status"),intern),Map.of("status","IN_PROGRESS","completionNote","Working"));
  ok(as(put("/api/tasks/"+taskId+"/status"),intern),Map.of("status","COMPLETED","completionNote","Done"));
  JsonNode ownTasks=ok(as(get("/api/tasks"),intern),null);
  assertEquals(1,ownTasks.size());
  assertEquals("COMPLETED",ownTasks.get(0).get("status").asText());
  JsonNode report=ok(as(post("/api/reports"),intern),Map.of("weekNumber",44,"completedWork","Completed assigned task","learned","Java"));
  long reportId=report.get("id").asLong();
  mvc.perform(as(put("/api/reports/"+reportId),outsider).contentType(MediaType.APPLICATION_JSON).content("{\"weekNumber\":44,\"completedWork\":\"tamper\"}")).andExpect(status().isForbidden());
  mvc.perform(as(put("/api/reports/"+reportId+"/review"),intern).contentType(MediaType.APPLICATION_JSON).content("{\"rating\":10}")).andExpect(status().isForbidden());
  mvc.perform(as(put("/api/reports/"+reportId+"/review"),oldMentor).contentType(MediaType.APPLICATION_JSON).content("{\"rating\":10}")).andExpect(status().isForbidden());
  ok(as(put("/api/reports/"+reportId+"/review"),admin),Map.of("rating",9,"mentorComment","Admin approved"));
  JsonNode visible=ok(as(get("/api/reports"),intern),null);
  assertEquals(1,visible.size());
  assertEquals("Admin approved",visible.get(0).get("mentorComment").asText());
  assertEquals("REVIEWED",visible.get(0).get("status").asText());
  ok(as(post("/api/evaluations"),admin),Map.of("internId",internId,"technicalSkill",9,"communication",8,"teamwork",8,"responsibility",9));
  assertEquals(1,ok(as(get("/api/evaluations"),intern),null).size());
  JsonNode stats=ok(as(get("/api/dashboard/statistics"),intern),null);
  assertEquals(1,stats.get("interns").asInt());
  assertEquals(1,stats.get("tasksCompleted").asInt());
  assertEquals(0,stats.get("tasksTodo").asInt());
  assertEquals(1,stats.get("reports").asInt());
  assertTrue(ok(as(get("/api/dashboard/statistics"),admin),null).get("interns").asInt()>1);
 }
}
