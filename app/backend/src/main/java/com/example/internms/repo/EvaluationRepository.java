package com.example.internms.repo;
import com.example.internms.model.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface EvaluationRepository extends JpaRepository<Evaluation,Long>{
    Optional<Evaluation> findByInternId(Long internId);
    List<Evaluation> findByMentorId(Long mentorId);
}
