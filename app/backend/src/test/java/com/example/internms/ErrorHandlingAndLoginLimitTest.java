package com.example.internms;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import java.util.UUID;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={
    "spring.datasource.url=jdbc:h2:mem:internms_test;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class ErrorHandlingAndLoginLimitTest {
    @Autowired MockMvc mvc;

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\""+email+"\",\"password\":\""+password+"\"}"));
    }

    @Test void unknownRouteReturns404Json() throws Exception {
        mvc.perform(get("/api/does-not-exist"))
           .andExpect(status().isNotFound())
           .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
           .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test void unsupportedMethodReturns405WithAllowHeader() throws Exception {
        mvc.perform(get("/api/admin/departments"))
           .andExpect(status().isMethodNotAllowed())
           .andExpect(header().string("Allow", containsString("POST")))
           .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test void unsupportedMediaTypeReturns415() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.TEXT_PLAIN).content("email=a&password=b"))
           .andExpect(status().isUnsupportedMediaType())
           .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test void fiveFailedLoginsLockTheEmailWith429() throws Exception {
        // Unique, non-existent email so the shared Spring context's other tests are not locked out.
        String email = "locked-"+UUID.randomUUID()+"@example.com";
        for (int i = 0; i < 5; i++) {
            login(email, "wrong-password").andExpect(status().isUnauthorized());
        }
        login(email, "wrong-password")
           .andExpect(status().isTooManyRequests())
           .andExpect(jsonPath("$.error", containsString("thử lại sau")));
        // Email normalization applies to the lock key as well.
        login("  "+email.toUpperCase()+" ", "wrong-password").andExpect(status().isTooManyRequests());
        // Other emails are unaffected.
        login("other-"+UUID.randomUUID()+"@example.com", "wrong-password").andExpect(status().isUnauthorized());
    }

    @Test void successfulLoginResetsFailureCounter() throws Exception {
        // Four failures, success, four more failures: never locked because success resets the counter.
        // Stays below the threshold so the shared demo account is never locked for other tests.
        String email = "mentor@gmail.com";
        for (int i = 0; i < 4; i++) login(email, "wrong-password").andExpect(status().isUnauthorized());
        login(email, "123456").andExpect(status().isOk());
        for (int i = 0; i < 4; i++) login(email, "wrong-password").andExpect(status().isUnauthorized());
        login(email, "123456").andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
    }
}
