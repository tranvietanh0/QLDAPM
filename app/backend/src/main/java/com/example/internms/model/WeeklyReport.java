package com.example.internms.model;

import jakarta.persistence.*;

@Entity
@Table(name="weekly_reports", uniqueConstraints=@UniqueConstraint(columnNames={"intern_id","week_number"}))
public class WeeklyReport {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional=false) @JoinColumn(name="intern_id") private InternProfile intern;
    @Column(name="week_number", nullable=false) private int weekNumber;
    @Column(length=3000) private String completedWork;
    @Column(length=3000) private String learned;
    @Column(length=3000) private String problems;
    @Column(length=3000) private String planNextWeek;
    @Enumerated(EnumType.STRING) @Column(nullable=false) private ReportStatus status=ReportStatus.SUBMITTED;
    @Column(length=3000) private String mentorComment;
    private Double rating;

    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public InternProfile getIntern(){return intern;} public void setIntern(InternProfile intern){this.intern=intern;}
    public int getWeekNumber(){return weekNumber;} public void setWeekNumber(int weekNumber){this.weekNumber=weekNumber;}
    public String getCompletedWork(){return completedWork;} public void setCompletedWork(String v){completedWork=v;}
    public String getLearned(){return learned;} public void setLearned(String v){learned=v;}
    public String getProblems(){return problems;} public void setProblems(String v){problems=v;}
    public String getPlanNextWeek(){return planNextWeek;} public void setPlanNextWeek(String v){planNextWeek=v;}
    public ReportStatus getStatus(){return status;} public void setStatus(ReportStatus v){status=v;}
    public String getMentorComment(){return mentorComment;} public void setMentorComment(String v){mentorComment=v;}
    public Double getRating(){return rating;} public void setRating(Double v){rating=v;}
}
