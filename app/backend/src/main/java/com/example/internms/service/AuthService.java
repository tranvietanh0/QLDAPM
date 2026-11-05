package com.example.internms.service;
import com.example.internms.model.*;
import com.example.internms.repo.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
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
 // Failed-login throttle, keyed by normalized email (known or unknown, so it does not reveal which accounts exist).
 // The window opens at the first failure; once MAX_FAILED_LOGINS is reached the email is rejected until the window ends.
 // In-memory only: counters reset on restart and are not shared between server instances.
 static final int MAX_FAILED_LOGINS=5;
 static final Duration FAILED_LOGIN_WINDOW=Duration.ofMinutes(15);
 private static final int MAX_TRACKED_EMAILS=10_000;
 private record FailedLogins(int count,Instant windowStart){}
 private final ConcurrentHashMap<String,FailedLogins> failedLogins=new ConcurrentHashMap<>();
 private static boolean expired(FailedLogins f,Instant now){return !now.isBefore(f.windowStart().plus(FAILED_LOGIN_WINDOW));}
 private void rejectIfLocked(String key,Instant now){
  FailedLogins f=failedLogins.get(key);
  if(f==null) return;
  if(expired(f,now)){failedLogins.remove(key,f);return;}
  if(f.count()>=MAX_FAILED_LOGINS){
   long minutes=Math.max(1,(Duration.between(now,f.windowStart().plus(FAILED_LOGIN_WINDOW)).toSeconds()+59)/60);
   throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Đăng nhập sai quá nhiều lần, vui lòng thử lại sau "+minutes+" phút");
  }
 }
 private void recordFailure(String key,Instant now){
  if(failedLogins.size()>=MAX_TRACKED_EMAILS) failedLogins.values().removeIf(f->expired(f,now));
  failedLogins.compute(key,(k,f)->f==null||expired(f,now)?new FailedLogins(1,now):new FailedLogins(f.count()+1,f.windowStart()));
 }
 @Transactional
 public Map<String,Object> login(String email,String password){ return login(email,password,null); }
 @Transactional
 // portalRoles: roles the calling portal accepts; null accepts any role (generic /api/auth/login).
 public Map<String,Object> login(String email,String password,Set<Role> portalRoles){
  if(email==null||password==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sai email hoặc mật khẩu");
  String key=email.trim().toLowerCase(Locale.ROOT);
  Instant now=Instant.now();
  rejectIfLocked(key,now);
  User u=users.findByEmail(key).orElse(null);
  if(u==null||!encoder.matches(password,u.getPassword())){recordFailure(key,now);throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sai email hoặc mật khẩu");}
  failedLogins.remove(key);
  if(portalRoles!=null&&!portalRoles.contains(u.getRole())) throw new ResponseStatusException(HttpStatus.FORBIDDEN,portalRoles.contains(Role.INTERN)?"Ứng dụng Client chỉ dành cho thực tập sinh":"Ứng dụng Server chỉ dành cho quản trị viên và mentor");
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
