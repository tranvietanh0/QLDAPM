package com.example.internms.model;

import jakarta.persistence.*;

@Entity
public class Evaluation {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @OneToOne(optional=false) private InternProfile intern;
    @ManyToOne(optional=false) private User mentor;
    private double technicalSkill;
    private double communication;
    private double teamwork;
    private double responsibility;
    private double overallScore;
    @Column(length=3000) private String comment;

    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public InternProfile getIntern(){return intern;} public void setIntern(InternProfile intern){this.intern=intern;}
    public User getMentor(){return mentor;} public void setMentor(User mentor){this.mentor=mentor;}
    public double getTechnicalSkill(){return technicalSkill;} public void setTechnicalSkill(double v){technicalSkill=v;}
    public double getCommunication(){return communication;} public void setCommunication(double v){communication=v;}
    public double getTeamwork(){return teamwork;} public void setTeamwork(double v){teamwork=v;}
    public double getResponsibility(){return responsibility;} public void setResponsibility(double v){responsibility=v;}
    public double getOverallScore(){return overallScore;} public void setOverallScore(double v){overallScore=v;}
    public String getComment(){return comment;} public void setComment(String v){comment=v;}
}
