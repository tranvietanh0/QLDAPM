package com.example.internms.repo;
import com.example.internms.model.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface UserSessionRepository extends JpaRepository<UserSession,String> {
 List<UserSession> findByUserId(Long userId);
}
