package com.example.internms.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name="intern_profiles")
public class InternProfile {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @OneToOne(optional=false) private User user;
    @ManyToOne(optional=false) private Department department;
    @ManyToOne(optional=false) private User mentor;
    @Column(nullable=false) private LocalDate startDate;
    @Column(nullable=false) private LocalDate endDate;
    @Column(nullable=false) private String status="ACTIVE";
    @Column(nullable=false) private int progress=0;

    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public User getUser(){return user;} public void setUser(User user){this.user=user;}
    public Department getDepartment(){return department;} public void setDepartment(Department department){this.department=department;}
    public User getMentor(){return mentor;} public void setMentor(User mentor){this.mentor=mentor;}
    public LocalDate getStartDate(){return startDate;} public void setStartDate(LocalDate startDate){this.startDate=startDate;}
    public LocalDate getEndDate(){return endDate;} public void setEndDate(LocalDate endDate){this.endDate=endDate;}
    public String getStatus(){return status;} public void setStatus(String status){this.status=status;}
    public int getProgress(){return progress;} public void setProgress(int progress){this.progress=progress;}
}
