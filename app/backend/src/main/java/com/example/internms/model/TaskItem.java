package com.example.internms.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name="tasks")
public class TaskItem {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false) private String title;
    @Column(length=2000) private String description;
    @Column(nullable=false) private String priority="MEDIUM";
    @Enumerated(EnumType.STRING) @Column(nullable=false) private TaskStatus status=TaskStatus.TODO;
    @Column(nullable=false) private LocalDate deadline;
    @ManyToOne(optional=false) private InternProfile intern;
    @ManyToOne(optional=false) private User mentor;
    @Column(length=2000) private String completionNote;

    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public String getTitle(){return title;} public void setTitle(String title){this.title=title;}
    public String getDescription(){return description;} public void setDescription(String description){this.description=description;}
    public String getPriority(){return priority;} public void setPriority(String priority){this.priority=priority;}
    public TaskStatus getStatus(){return status;} public void setStatus(TaskStatus status){this.status=status;}
    public LocalDate getDeadline(){return deadline;} public void setDeadline(LocalDate deadline){this.deadline=deadline;}
    public InternProfile getIntern(){return intern;} public void setIntern(InternProfile intern){this.intern=intern;}
    public User getMentor(){return mentor;} public void setMentor(User mentor){this.mentor=mentor;}
    public String getCompletionNote(){return completionNote;} public void setCompletionNote(String completionNote){this.completionNote=completionNote;}
}
