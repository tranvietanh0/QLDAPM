package com.example.internms.controller;
import com.example.internms.model.User;
import com.example.internms.model.Role;
import com.example.internms.service.AuthService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/auth")
public class AuthController {
 private final AuthService auth; public AuthController(AuthService auth){this.auth=auth;}
 // The Admin/Server app serves both admins and mentors; per-role data filtering happens in each controller.
 private static final Set<Role> ADMIN_PORTAL=Collections.unmodifiableSet(EnumSet.of(Role.ADMIN,Role.MENTOR));
 private static final Set<Role> INTERN_PORTAL=Collections.unmodifiableSet(EnumSet.of(Role.INTERN));
 public record LoginRequest(String email,String password){}
 public record PasswordRequest(String currentPassword,String newPassword){}
 @PostMapping("/login") public Map<String,Object> login(@RequestBody LoginRequest r){return auth.login(r.email(),r.password());}
 @PostMapping("/admin/login") public Map<String,Object> adminLogin(@RequestBody LoginRequest r){return auth.login(r.email(),r.password(),ADMIN_PORTAL);}
 @PostMapping("/intern/login") public Map<String,Object> internLogin(@RequestBody LoginRequest r){return auth.login(r.email(),r.password(),INTERN_PORTAL);}
 @PostMapping("/logout") public Map<String,String> logout(@RequestHeader("Authorization") String h){auth.logout(h);return Map.of("message","Đã đăng xuất");}
 @PutMapping("/password") public Map<String,String> changePassword(@RequestHeader("Authorization") String h,@RequestBody PasswordRequest p){auth.changePassword(h,p.currentPassword(),p.newPassword());return Map.of("message","Đổi mật khẩu thành công, vui lòng đăng nhập lại");}
 @GetMapping("/me") public Map<String,Object> me(@RequestHeader("Authorization") String h){User u=auth.requireUser(h);return Map.of("id",u.getId(),"name",u.getName(),"email",u.getEmail(),"role",u.getRole());}
}
