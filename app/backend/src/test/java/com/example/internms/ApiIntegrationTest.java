package com.example.internms;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={
    "spring.datasource.url=jdbc:h2:mem:internms_test;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token(String email) throws Exception {
        String body = "{\"email\":\""+email+"\",\"password\":\"123456\"}";
        String result = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(result).get("token").asText();
    }

    @Test void healthLoginAndPermissions() throws Exception {
        mvc.perform(get("/api/health"))
           .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/api/interns")).andExpect(status().isUnauthorized());
        String internToken=token("intern@gmail.com");
        mvc.perform(get("/api/interns").header("Authorization","Bearer "+internToken))
           .andExpect(status().isOk());
        mvc.perform(post("/api/admin/departments")
           .header("Authorization","Bearer "+internToken)
           .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"ForbiddenTest\"}"))
           .andExpect(status().isForbidden());
    }

    @Test void coreFlowTaskReportEvaluation() throws Exception {
        String admin=token("admin@gmail.com");
        String mentor=token("mentor@gmail.com");
        String intern=token("intern@gmail.com");
        // Sử dụng profile được seed: ID được lấy từ API, không hard-code.
        String profiles=mvc.perform(get("/api/interns").header("Authorization","Bearer "+intern))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode rows=json.readTree(profiles);
        assertTrue(rows.isArray()); assertFalse(rows.isEmpty());
        long id=rows.get(0).get("id").asLong();
        long mentorId=rows.get(0).get("mentor").get("id").asLong();
        assertTrue(mentorId>0);
        String taskBody="{\"internId\":"+id+",\"title\":\"Test task\",\"deadline\":\"2026-12-01\",\"priority\":\"HIGH\"}";
        String response=mvc.perform(post("/api/tasks").header("Authorization","Bearer "+mentor)
             .contentType(MediaType.APPLICATION_JSON).content(taskBody)).andExpect(status().isOk())
             .andReturn().getResponse().getContentAsString();
        long taskId=json.readTree(response).get("id").asLong();
        mvc.perform(put("/api/tasks/{id}/status",taskId).header("Authorization","Bearer "+intern)
             .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}"))
             .andExpect(status().isOk());
        mvc.perform(put("/api/tasks/{id}/status",taskId).header("Authorization","Bearer "+intern)
             .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\",\"completionNote\":\"Done\"}"))
             .andExpect(status().isOk());
        String report=mvc.perform(post("/api/reports").header("Authorization","Bearer "+intern)
             .contentType(MediaType.APPLICATION_JSON).content("{\"weekNumber\":45,\"completedWork\":\"Finished test\"}"))
             .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long reportId=json.readTree(report).get("id").asLong();
        mvc.perform(put("/api/reports/{id}/review",reportId)
             .header("Authorization","Bearer "+mentor).contentType(MediaType.APPLICATION_JSON)
             .content("{\"rating\":9,\"mentorComment\":\"Great\"}"))
             .andExpect(status().isOk());
        mvc.perform(post("/api/evaluations").header("Authorization","Bearer "+mentor)
             .contentType(MediaType.APPLICATION_JSON)
             .content("{\"internId\":"+id+",\"technicalSkill\":9,\"communication\":8,\"teamwork\":8,\"responsibility\":9}"))
             .andExpect(status().isOk());
        mvc.perform(get("/api/dashboard/statistics").header("Authorization","Bearer "+admin))
             .andExpect(status().isOk());
    }
}
