package com.example.internms;

import com.example.internms.model.Role;
import com.example.internms.model.User;
import com.example.internms.repo.UserRepository;
import com.example.internms.repo.UserSessionRepository;
import com.example.internms.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.server.ResponseStatusException;
import java.lang.reflect.Field;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Error responses and the failed-login throttle. HTTP tests use random non-existent emails only, so the
 * Spring context shared with other test classes never counts failures against seeded demo accounts.
 * Behaviour that needs a real password or a moving clock runs against a standalone AuthService.
 */
@SpringBootTest(properties={
    "spring.datasource.url=jdbc:h2:mem:internms_test;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class ErrorHandlingAndLoginLimitTest {
    private static final int LIMIT = 5;
    private static final int MAX_TRACKED = 10_000;
    private static final String PASSWORD = "correct-password";

    @Autowired MockMvc mvc;

    private static String fakeEmail(String prefix) {
        return prefix+"-"+UUID.randomUUID()+"@example.com";
    }

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\""+email+"\",\"password\":\""+password+"\"}"));
    }

    /** Clock whose time only moves when the test says so. */
    private static final class MutableClock extends Clock {
        private volatile Instant now = Instant.parse("2026-11-05T03:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private record Standalone(AuthService auth, UserRepository users, User user) {}

    /**
     * AuthService with mocked repositories; one known account "user@example.com" has PASSWORD. The user is a spy so
     * tests can count password-hash reads, i.e. BCrypt checks.
     */
    private static Standalone standalone(Clock clock) {
        UserRepository users = mock(UserRepository.class);
        AuthService auth = new AuthService(users, mock(UserSessionRepository.class), clock);
        User user = spy(new User("Test User", "user@example.com", auth.hash(PASSWORD), Role.MENTOR));
        user.setId(1L);
        when(users.findByEmail(anyString())).thenReturn(Optional.empty());
        when(users.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        return new Standalone(auth, users, user);
    }

    private static HttpStatus statusOf(AuthService auth, String email, String password) {
        try {
            auth.login(email, password);
            return HttpStatus.OK;
        } catch (ResponseStatusException e) {
            return HttpStatus.valueOf(e.getStatusCode().value());
        }
    }

    @SuppressWarnings("unchecked")
    private static int trackedEmails(AuthService auth) throws Exception {
        Field f = AuthService.class.getDeclaredField("loginAttempts");
        f.setAccessible(true);
        return ((Map<String, ?>) f.get(auth)).size();
    }

    /** Fires {@code n} calls at once and returns their results. */
    private static <T> List<T> concurrently(int n, Callable<T> call) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<T>> futures = new ArrayList<>();
            for (int i = 0; i < n; i++) futures.add(pool.submit(() -> { start.await(); return call.call(); }));
            start.countDown();
            List<T> out = new ArrayList<>();
            for (Future<T> f : futures) out.add(f.get(60, TimeUnit.SECONDS));
            return out;
        } finally {
            pool.shutdownNow();
        }
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
        String email = fakeEmail("locked");
        for (int i = 0; i < LIMIT; i++) {
            login(email, "wrong-password").andExpect(status().isUnauthorized());
        }
        login(email, "wrong-password")
           .andExpect(status().isTooManyRequests())
           .andExpect(jsonPath("$.error", containsString("thử lại sau")));
        // Email normalization applies to the lock key as well.
        login("  "+email.toUpperCase()+" ", "wrong-password").andExpect(status().isTooManyRequests());
        // Other emails are unaffected.
        login(fakeEmail("other"), "wrong-password").andExpect(status().isUnauthorized());
    }

    @Test void overlongEmailIsRejectedWith400() throws Exception {
        String email = "a".repeat(250)+"@example.com";
        for (int i = 0; i < LIMIT+2; i++) {
            // Never tracked, so it never turns into 429.
            login(email, "wrong-password").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").isNotEmpty());
        }
        login("b".repeat(242)+"@example.com", "wrong-password").andExpect(status().isUnauthorized()); // exactly 254
    }

    @Test void concurrentWrongPasswordsOverHttpReturnFive401ThenLocked() throws Exception {
        // Checks status codes only; the reserve-before-check race is covered by the standalone BCrypt-count test below.
        String email = fakeEmail("burst");
        List<Integer> codes = concurrently(20,
            () -> login(email, "wrong-password").andReturn().getResponse().getStatus());
        assertEquals(LIMIT, codes.stream().filter(c -> c == 401).count(), "evaluated attempts: "+codes);
        assertEquals(20 - LIMIT, codes.stream().filter(c -> c == 429).count(), "rejected attempts: "+codes);
    }

    @Test void concurrentWrongPasswordsAgainstBcryptAccountCheckAtMostFivePasswords() throws Exception {
        // Real BCrypt makes each check slow, which is where check-then-record accounting used to leak attempts.
        Standalone s = standalone(Clock.systemUTC());
        List<HttpStatus> results = concurrently(20, () -> statusOf(s.auth(), "user@example.com", "wrong-password"));
        assertEquals(LIMIT, results.stream().filter(r -> r == HttpStatus.UNAUTHORIZED).count(), results.toString());
        assertEquals(20 - LIMIT, results.stream().filter(r -> r == HttpStatus.TOO_MANY_REQUESTS).count(), results.toString());
        // The account is looked up on every attempt, but its hash is read (BCrypt runs) only for the reserved five.
        verify(s.user(), times(LIMIT)).getPassword();
    }

    @Test void emailVariantsResolvingToOneAccountShareOneCounter() {
        // An accent-insensitive DB collation matches both variants to the same stored account.
        Standalone s = standalone(new MutableClock());
        String accented = "úser@example.com"; // "úser@example.com"
        when(s.users().findByEmail(accented)).thenReturn(Optional.of(s.user()));
        for (int i = 0; i < 3; i++) assertEquals(HttpStatus.UNAUTHORIZED, statusOf(s.auth(), "user@example.com", "wrong"));
        for (int i = 0; i < 2; i++) assertEquals(HttpStatus.UNAUTHORIZED, statusOf(s.auth(), accented, "wrong"));
        // Sixth attempt across the variants is refused, whichever variant and even with the right password.
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, statusOf(s.auth(), accented, PASSWORD));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, statusOf(s.auth(), "user@example.com", PASSWORD));
    }

    @Test void successfulLoginResetsTheCounterButNotWhileLocked() {
        Standalone s = standalone(new MutableClock());
        for (int i = 0; i < LIMIT-1; i++) assertEquals(HttpStatus.UNAUTHORIZED, statusOf(s.auth(), "user@example.com", "wrong"));
        assertEquals(HttpStatus.OK, statusOf(s.auth(), "user@example.com", PASSWORD));
        for (int i = 0; i < LIMIT-1; i++) assertEquals(HttpStatus.UNAUTHORIZED, statusOf(s.auth(), "user@example.com", "wrong"));
        assertEquals(HttpStatus.OK, statusOf(s.auth(), "user@example.com", PASSWORD));

        for (int i = 0; i < LIMIT; i++) assertEquals(HttpStatus.UNAUTHORIZED, statusOf(s.auth(), "user@example.com", "wrong"));
        // Once locked, even the right password is refused until the window ends.
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, statusOf(s.auth(), "user@example.com", PASSWORD));
    }

    @Test void lockExpiresAfterTheFifteenMinuteWindow() {
        MutableClock clock = new MutableClock();
        Standalone s = standalone(clock);
        for (int i = 0; i < LIMIT; i++) assertEquals(HttpStatus.UNAUTHORIZED, statusOf(s.auth(), "user@example.com", "wrong"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, statusOf(s.auth(), "user@example.com", PASSWORD));

        clock.advance(Duration.ofMinutes(15).minusSeconds(1));
        ResponseStatusException stillLocked = assertThrows(ResponseStatusException.class,
            () -> s.auth().login("user@example.com", PASSWORD));
        assertEquals(429, stillLocked.getStatusCode().value());
        assertThat(stillLocked.getReason(), containsString("1 phút"));

        clock.advance(Duration.ofSeconds(1));
        assertEquals(HttpStatus.OK, statusOf(s.auth(), "user@example.com", PASSWORD));
    }

    @Test void trackedEmailsStayBoundedAndUnlockedFloodEntriesAreEvictedBeforeALockedOne() throws Exception {
        // Only covers a flood of unlocked entries. A map full of locked entries can still evict a locked one and
        // reset its counter; that is an accepted residual risk documented in AuthService.
        MutableClock clock = new MutableClock();
        Standalone s = standalone(clock);
        String target = "target@example.com";
        for (int i = 0; i < LIMIT; i++) statusOf(s.auth(), target, "wrong");
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, statusOf(s.auth(), target, "wrong"));

        for (int i = 0; i < MAX_TRACKED + 500; i++) {
            assertEquals(HttpStatus.UNAUTHORIZED, statusOf(s.auth(), "flood-"+i+"@example.com", "wrong"));
        }
        assertTrue(trackedEmails(s.auth()) <= MAX_TRACKED, "tracked: "+trackedEmails(s.auth()));
        // The sampled entries included unlocked flood entries, so eviction picked those and kept the locked email.
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, statusOf(s.auth(), target, "wrong"));

        // After the window, the next new email at capacity prunes every expired entry.
        clock.advance(Duration.ofMinutes(16));
        assertEquals(HttpStatus.UNAUTHORIZED, statusOf(s.auth(), "after-window@example.com", "wrong"));
        assertEquals(1, trackedEmails(s.auth()));
    }
}
