package com.example.internms.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="user_sessions",indexes={@Index(name="ix_session_user",columnList="user_id")})
public class UserSession {
 @Id @Column(length=64) private String tokenHash;
 @ManyToOne(optional=false) @JoinColumn(name="user_id") private User user;
 @Column(nullable=false) private Instant expiresAt;
 public UserSession() {}
 public UserSession(String hash,User user,Instant expiry){this.tokenHash=hash;this.user=user;this.expiresAt=expiry;}
 public String getTokenHash(){return tokenHash;}
 public User getUser(){return user;}
 public Instant getExpiresAt(){return expiresAt;}
}
