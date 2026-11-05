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

    private ResultActions portalLogin(String portal,String email) throws Exception {
        return mvc.perform(post("/api/auth/"+portal+"/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\""+email+"\",\"password\":\"123456\"}"));
    }

    private String token(String portal,String email) throws Exception {
        String body=portalLogin(portal,email).andExpect(status().isOk())
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

        // Mentor sees only interns assigned to them, and admin-only endpoints stay closed.
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
}
