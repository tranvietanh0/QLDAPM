package com.example.internms.service;
import com.example.internms.model.*;
import com.example.internms.repo.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class AuthService {
 private final UserRepository users;
 private final UserSessionRepository sessions;
 private final Clock clock;
 private final BCryptPasswordEncoder encoder=new BCryptPasswordEncoder();
 private final SecureRandom random=new SecureRandom();
 @Value("${app.session.hours:12}") private long durationHours;
 @Autowired public AuthService(UserRepository users,UserSessionRepository sessions){this(users,sessions,Clock.systemUTC());}
 // The clock drives the failed-login window; tests pass a controllable one.
 public AuthService(UserRepository users,UserSessionRepository sessions,Clock clock){this.users=users;this.sessions=sessions;this.clock=Objects.requireNonNull(clock);}
 public String hash(String raw){return encoder.encode(raw);}
 private String digest(String input){
  try{byte[] hash=MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)); return HexFormat.of().formatHex(hash);}
  catch(Exception e){throw new IllegalStateException(e);}
 }
 private String tokenFrom(String header){
  if(header==null||!header.startsWith("Bearer ")||header.substring(7).isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Vui lòng đăng nhập");
  return header.substring(7).trim();
 }
 // Failed-login throttle. The key is canonical: when the typed email resolves to an account, the account's stored
 // email (lower-cased) is used, because the DB collation is accent-insensitive and several typed variants
 // ("admin@..", "ádmin@..") can match the same user; they must share one counter. Unknown emails are keyed by the
 // normalized typed string and counted exactly like real ones, but they skip BCrypt, so response timing can still
 // hint whether an account exists: this limits guessing, not enumeration.
 // Every attempt reserves a slot atomically (ConcurrentHashMap.compute) BEFORE the password is checked, so concurrent
 // requests cannot evaluate more than MAX_FAILED_LOGINS passwords per account per window. A successful login clears it.
 // The window opens at the first attempt; further attempts inside the window get 429 until it ends.
 // Memory is bounded: emails longer than MAX_EMAIL_LENGTH are rejected before tracking, and at MAX_TRACKED_EMAILS
 // entries the expired ones are pruned (a full scan at most once per PRUNE_INTERVAL); if still full, one entry is
 // evicted, preferring an unlocked one from a small sample. Accepted residual risk: once the map is full of LOCKED
 // entries (an attacker locking ~10,000 fake emails), the sample holds no unlocked entry, so a flood of further fake
 // emails evicts locked entries too and can reset a real account's counter. Its cost is bounded by the
 // MAX_TRACKED_EMAILS cap (roughly 300k cheap requests), but it is not prevented.
 // In-memory only: counters reset on restart and are not shared between server instances.
 static final int MAX_FAILED_LOGINS=5;
 static final Duration FAILED_LOGIN_WINDOW=Duration.ofMinutes(15);
 static final int MAX_EMAIL_LENGTH=254;
 static final int MAX_TRACKED_EMAILS=10_000;
 private static final Duration PRUNE_INTERVAL=Duration.ofMinutes(1);
 private static final int EVICTION_SAMPLE=8;
 private record LoginAttempts(int count,Instant windowStart){}
 private final ConcurrentHashMap<String,LoginAttempts> loginAttempts=new ConcurrentHashMap<>();
 private final AtomicReference<Instant> lastPrune=new AtomicReference<>(Instant.EPOCH);
 private static boolean expired(LoginAttempts a,Instant now){return !now.isBefore(a.windowStart().plus(FAILED_LOGIN_WINDOW));}
 private static boolean locked(LoginAttempts a,Instant now){return a.count()>=MAX_FAILED_LOGINS&&!expired(a,now);}
 private void makeRoom(Instant now){
  Instant last=lastPrune.get();
  if(!now.isBefore(last.plus(PRUNE_INTERVAL))&&lastPrune.compareAndSet(last,now)) loginAttempts.values().removeIf(a->expired(a,now));
  if(loginAttempts.size()<MAX_TRACKED_EMAILS) return;
  String victim=null;int seen=0;
  for(Map.Entry<String,LoginAttempts> e:loginAttempts.entrySet()){
   if(victim==null) victim=e.getKey();
   if(!locked(e.getValue(),now)){victim=e.getKey();break;}
   if(++seen>=EVICTION_SAMPLE) break;
  }
  if(victim!=null) loginAttempts.remove(victim);
 }
 // Reserves one attempt for key, or throws 429 when the window's attempts are used up.
 private void reserveAttempt(String key,Instant now){
  if(loginAttempts.size()>=MAX_TRACKED_EMAILS&&!loginAttempts.containsKey(key)) makeRoom(now);
  LoginAttempts a=loginAttempts.compute(key,(k,o)->o==null||expired(o,now)?new LoginAttempts(1,now)
   :new LoginAttempts(Math.min(o.count()+1,MAX_FAILED_LOGINS+1),o.windowStart()));
  if(a.count()>MAX_FAILED_LOGINS){
   long minutes=Math.max(1,(Duration.between(now,a.windowStart().plus(FAILED_LOGIN_WINDOW)).toSeconds()+59)/60);
   throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Đăng nhập sai quá nhiều lần, vui lòng thử lại sau "+minutes+" phút");
  }
 }
 @Transactional
 public Map<String,Object> login(String email,String password){ return login(email,password,null); }
 @Transactional
 // portalRoles: roles the calling portal accepts; null accepts any role (generic /api/auth/login).
 public Map<String,Object> login(String email,String password,Set<Role> portalRoles){
  if(email==null||password==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sai email hoặc mật khẩu");
  String key=email.trim().toLowerCase(Locale.ROOT);
  if(key.length()>MAX_EMAIL_LENGTH) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Email không hợp lệ");
  // Look up first (no BCrypt yet) so the attempt is reserved under the canonical key, still before the password check.
  User u=users.findByEmail(key).orElse(null);
  String lockKey=u!=null&&u.getEmail()!=null?u.getEmail().trim().toLowerCase(Locale.ROOT):key;
  reserveAttempt(lockKey,clock.instant());
  if(u==null||!encoder.matches(password,u.getPassword())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sai email hoặc mật khẩu");
  loginAttempts.remove(lockKey);
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
