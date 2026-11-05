package com.example.internms.repo;
import com.example.internms.model.WeeklyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface WeeklyReportRepository extends JpaRepository<WeeklyReport,Long>{
    List<WeeklyReport> findByInternId(Long internId);
    Optional<WeeklyReport> findByInternIdAndWeekNumber(Long internId, int weekNumber);
}
