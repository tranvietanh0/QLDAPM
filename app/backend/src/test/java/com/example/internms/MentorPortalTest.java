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
import org.springframework.test.web.servlet.ResultActions;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** The Admin/Server portal serves both admins and mentors; the Client portal stays intern-only. */
@SpringBootTest(properties={
    "spring.datasource.url=jdbc:h2:mem:mentor_portal;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class MentorPortalTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private static final String DEMO_PASSWORD="123456";
    private static final String OTHER_PASSWORD="mentor-b-pass1";

    private ResultActions portalLogin(String portal,String email) throws Exception {
        return portalLogin(portal,email,DEMO_PASSWORD);
    }

    private ResultActions portalLogin(String portal,String email,String password) throws Exception {
        return mvc.perform(post("/api/auth/"+portal+"/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\""+email+"\",\"password\":\""+password+"\"}"));
    }

    private String token(String portal,String email) throws Exception {
        return token(portal,email,DEMO_PASSWORD);
    }

    private String token(String portal,String email,String password) throws Exception {
        String body=portalLogin(portal,email,password).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return "Bearer "+json.readTree(body).get("token").asText();
    }

    private JsonNode body(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    @Test void adminPortalAcceptsAdminAndMentorButNotIntern() throws Exception {
        portalLogin("admin","admin@gmail.com").andExpect(status().isOk()).andExpect(jsonPath("$.role").value("ADMIN"));
        portalLogin("admin","mentor@gmail.com").andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MENTOR"));
        portalLogin("admin","intern@gmail.com").andExpect(status().isForbidden());
    }

    @Test void internPortalStillAcceptsOnlyInterns() throws Exception {
        portalLogin("intern","intern@gmail.com").andExpect(status().isOk()).andExpect(jsonPath("$.role").value("INTERN"));
        portalLogin("intern","mentor@gmail.com").andExpect(status().isForbidden());
        portalLogin("intern","admin@gmail.com").andExpect(status().isForbidden());
    }

    @Test void mentorFromAdminPortalAssignsTaskReviewsReportAndEvaluates() throws Exception {
        String mentor=token("admin","mentor@gmail.com");
        String intern=token("intern","intern@gmail.com");

        // The mentor has an intern to work with (isolation from other mentors is covered below), and admin-only endpoints stay closed.
        JsonNode interns=body(mvc.perform(get("/api/interns").header("Authorization",mentor)).andExpect(status().isOk()));
        assertFalse(interns.isEmpty());
        long internId=interns.get(0).get("id").asLong();
        mvc.perform(post("/api/admin/departments").header("Authorization",mentor)
            .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"MentorForbidden\"}"))
            .andExpect(status().isForbidden());

        long taskId=body(mvc.perform(post("/api/tasks").header("Authorization",mentor)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"internId\":"+internId+",\"title\":\"Mentor portal task\",\"deadline\":\"2026-12-01\",\"priority\":\"MEDIUM\"}"))
            .andExpect(status().isOk())).get("id").asLong();
        assertTrue(taskId>0);

        long reportId=body(mvc.perform(post("/api/reports").header("Authorization",intern)
            .contentType(MediaType.APPLICATION_JSON).content("{\"weekNumber\":40,\"completedWork\":\"Mentor portal week\"}"))
            .andExpect(status().isOk())).get("id").asLong();
        mvc.perform(put("/api/reports/{id}/review",reportId).header("Authorization",mentor)
            .contentType(MediaType.APPLICATION_JSON).content("{\"rating\":8,\"mentorComment\":\"Tốt\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVIEWED"));

        String evaluation="{\"internId\":"+internId+",\"technicalSkill\":8,\"communication\":8,\"teamwork\":9,\"responsibility\":9}";
        long evaluationId=body(mvc.perform(post("/api/evaluations").header("Authorization",mentor)
            .contentType(MediaType.APPLICATION_JSON).content(evaluation))
            .andExpect(status().isOk())).get("id").asLong();
        assertTrue(evaluationId>0);
    }

    private static List<Long> ids(JsonNode rows) {
        List<Long> out=new ArrayList<>();
        rows.forEach(r->out.add(r.get("id").asLong()));
        return out;
    }

    @Test void mentorsOnlySeeTheirOwnInternsTasksAndReports() throws Exception {
        String admin=token("admin","admin@gmail.com");
        String mentorA=token("admin","mentor@gmail.com");
        long departmentId=body(mvc.perform(get("/api/departments").header("Authorization",admin))
            .andExpect(status().isOk())).get(0).get("id").asLong();

        // Second mentor with an intern of their own.
        long mentorBId=body(mvc.perform(post("/api/admin/mentors").header("Authorization",admin)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Mentor B\",\"email\":\"mentor-b@example.com\",\"password\":\""+OTHER_PASSWORD+"\"}"))
            .andExpect(status().isOk())).get("id").asLong();
        long internBId=body(mvc.perform(post("/api/interns").header("Authorization",admin)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Intern B\",\"email\":\"intern-b@example.com\",\"password\":\""+OTHER_PASSWORD+"\","
                +"\"departmentId\":"+departmentId+",\"mentorId\":"+mentorBId+",\"startDate\":\"2026-09-01\",\"endDate\":\"2027-06-30\"}"))
            .andExpect(status().isOk())).get("id").asLong();
        String mentorB=token("admin","mentor-b@example.com",OTHER_PASSWORD);
        String internB=token("intern","intern-b@example.com",OTHER_PASSWORD);

        // Interns: each mentor's list holds only their own interns, and the other's profile is 403.
        List<Long> internsA=ids(body(mvc.perform(get("/api/interns").header("Authorization",mentorA)).andExpect(status().isOk())));
        List<Long> internsB=ids(body(mvc.perform(get("/api/interns").header("Authorization",mentorB)).andExpect(status().isOk())));
        assertFalse(internsA.isEmpty());
        assertFalse(internsA.contains(internBId));
        assertEquals(List.of(internBId),internsB);
        long internAId=internsA.get(0);
        mvc.perform(get("/api/interns/{id}",internBId).header("Authorization",mentorA)).andExpect(status().isForbidden());
        mvc.perform(get("/api/interns/{id}",internAId).header("Authorization",mentorB)).andExpect(status().isForbidden());

        // Tasks: mentor B's task is invisible to mentor A, and A cannot assign work to B's intern.
        long taskBId=body(mvc.perform(post("/api/tasks").header("Authorization",mentorB)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"internId\":"+internBId+",\"title\":\"Mentor B task\",\"deadline\":\"2026-12-01\",\"priority\":\"LOW\"}"))
            .andExpect(status().isOk())).get("id").asLong();
        List<Long> tasksA=ids(body(mvc.perform(get("/api/tasks").header("Authorization",mentorA)).andExpect(status().isOk())));
        List<Long> tasksB=ids(body(mvc.perform(get("/api/tasks").header("Authorization",mentorB)).andExpect(status().isOk())));
        assertFalse(tasksA.contains(taskBId));
        assertEquals(List.of(taskBId),tasksB);
        mvc.perform(post("/api/tasks").header("Authorization",mentorA)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"internId\":"+internBId+",\"title\":\"Not my intern\",\"deadline\":\"2026-12-01\",\"priority\":\"LOW\"}"))
            .andExpect(status().isForbidden());

        // Reports: intern B's report reaches mentor B only.
        long reportBId=body(mvc.perform(post("/api/reports").header("Authorization",internB)
            .contentType(MediaType.APPLICATION_JSON).content("{\"weekNumber\":41,\"completedWork\":\"Intern B week\"}"))
            .andExpect(status().isOk())).get("id").asLong();
        assertFalse(ids(body(mvc.perform(get("/api/reports").header("Authorization",mentorA)).andExpect(status().isOk()))).contains(reportBId));
        assertEquals(List.of(reportBId),ids(body(mvc.perform(get("/api/reports").header("Authorization",mentorB)).andExpect(status().isOk()))));
    }
}
