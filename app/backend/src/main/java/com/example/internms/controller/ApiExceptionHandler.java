package com.example.internms.controller;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import jakarta.validation.ConstraintViolationException;
import java.util.*;
@RestControllerAdvice
public class ApiExceptionHandler {
 @ExceptionHandler(ResponseStatusException.class)
 public ResponseEntity<Map<String,String>> status(ResponseStatusException e){return ResponseEntity.status(e.getStatusCode()).body(Map.of("error",e.getReason()==null?"Yêu cầu không hợp lệ":e.getReason()));}
 @ExceptionHandler(NoSuchElementException.class)
 public ResponseEntity<Map<String,String>> notfound(Exception e){return ResponseEntity.status(404).body(Map.of("error","Không tìm thấy dữ liệu"));}
 @ExceptionHandler({DataIntegrityViolationException.class,ConstraintViolationException.class})
 public ResponseEntity<Map<String,String>> conflict(Exception e){return ResponseEntity.status(409).body(Map.of("error","Dữ liệu đang được sử dụng hoặc bị trùng"));}
 @ExceptionHandler(MissingRequestHeaderException.class)
 public ResponseEntity<Map<String,String>> missingAuth(MissingRequestHeaderException e){return ResponseEntity.status(e.getHeaderName().equalsIgnoreCase("Authorization")?401:400).body(Map.of("error", "Authorization".equalsIgnoreCase(e.getHeaderName())?"Vui lòng đăng nhập":"Thiếu thông tin bắt buộc"));}
 @ExceptionHandler(MethodArgumentTypeMismatchException.class)
 public ResponseEntity<Map<String,String>> mismatch(Exception e){return ResponseEntity.badRequest().body(Map.of("error","Tham số đường dẫn không hợp lệ"));}
 @ExceptionHandler({HttpMessageNotReadableException.class,IllegalArgumentException.class})
 public ResponseEntity<Map<String,String>> badrequest(Exception e){return ResponseEntity.badRequest().body(Map.of("error","Dữ liệu gửi lên không hợp lệ"));}
 @ExceptionHandler(Exception.class)
 public ResponseEntity<Map<String,String>> generic(Exception e){return ResponseEntity.status(500).body(Map.of("error","Lỗi máy chủ, hãy kiểm tra nhật ký server"));}
}
