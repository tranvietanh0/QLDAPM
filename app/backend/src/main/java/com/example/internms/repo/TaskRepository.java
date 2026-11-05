package com.example.internms.repo;
import com.example.internms.model.TaskItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface TaskRepository extends JpaRepository<TaskItem,Long>{
    List<TaskItem> findByInternId(Long internId);
    List<TaskItem> findByMentorId(Long mentorId);
    long countByStatus(com.example.internms.model.TaskStatus status);
}
