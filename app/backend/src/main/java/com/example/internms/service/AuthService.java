package com.example.internms.service;
import com.example.internms.model.*;
import com.example.internms.repo.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Instant;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class AuthService {
 private final UserRepository users;
 private final UserSessionRepository sessions;
 private final BCryptPasswordEncoder encoder=new BCryptPasswordEncoder();
 private final SecureRandom random=new SecureRandom();
 @Value("${app.session.hours:12}") private long durationHours;
 public AuthService(UserRepository users,UserSessionRepository sessions){this.users=users;this.sessions=sessions;}
 public String hash(String raw){return encoder.encode(raw);}
 private String digest(String input){
  try{byte[] hash=MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)); return HexFormat.of().formatHex(hash);}
  catch(Exception e){throw new IllegalStateException(e);}
 }
 private String tokenFrom(String header){
  if(header==null||!header.startsWith("Bearer ")||header.substring(7).isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Vui lòng đăng nhập");
  return header.substring(7).trim();
 }
 @Transactional
 public Map<String,Object> login(String email,String password){ return login(email,password,null); }
 @Transactional
 public Map<String,Object> login(String email,String password,Role portalRole){
  if(email==null||password==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sai email hoặc mật khẩu");
  User u=users.findByEmail(email.trim().toLowerCase(Locale.ROOT)).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sai email hoặc mật khẩu"));
  if(!encoder.matches(password,u.getPassword())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sai email hoặc mật khẩu");
  if(portalRole!=null&&u.getRole()!=portalRole) throw new ResponseStatusException(HttpStatus.FORBIDDEN,portalRole==Role.ADMIN?"Ứng dụng Server chỉ dành cho quản trị viên":"Ứng dụng Client chỉ dành cho thực tập sinh");
  byte[] bytes=new byte[32];random.nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  sessions.save(new UserSession(digest(token),u,Instant.now().plusSeconds(Math.max(1,durationHours)*3600)));
  return Map.of("token",token,"role",u.getRole().name(),"name",u.getName(),"userId",u.getId());
 }
 @Transactional(readOnly=true)
 public User requireUser(String header){
  UserSession s=sessions.findById(digest(tokenFrom(header))).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Phiên đăng nhập không hợp lệ"));
  if(!s.getExpiresAt().isAfter(Instant.now())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Phiên đăng nhập đã hết hạn");
  return s.getUser();
 }
 public User requireRole(String h,Role... roles){User u=requireUser(h);if(Arrays.stream(roles).noneMatch(role->u.getRole()==role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền thao tác");return u;}
 @Transactional public void logout(String header){sessions.findById(digest(tokenFrom(header))).ifPresent(sessions::delete);}
 @Transactional public void revokeUser(Long id){sessions.deleteAll(sessions.findByUserId(id));}
 @Transactional public void changePassword(String header,String current,String fresh){
  User u=requireUser(header);
  if(current==null||!encoder.matches(current,u.getPassword())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu cũ không đúng");
  if(fresh==null||fresh.length()<8||fresh.length()>72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mật khẩu mới phải từ 8 đến 72 ký tự");
  u.setPassword(hash(fresh));users.save(u);revokeUser(u.getId());
 }
}
