package com.example.internms.repo;
import com.example.internms.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface InternProfileRepository extends JpaRepository<InternProfile,Long>{
    Optional<InternProfile> findByUserId(Long userId);
    List<InternProfile> findByMentorId(Long mentorId);
    List<InternProfile> findByDepartmentId(Long departmentId);
}
