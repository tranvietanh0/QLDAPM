package com.example.internms.controller;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;
@RestControllerAdvice
public class ApiExceptionHandler {
 private static final Logger log=LoggerFactory.getLogger(ApiExceptionHandler.class);
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
 @ExceptionHandler(NoResourceFoundException.class)
 public ResponseEntity<Map<String,String>> noRoute(NoResourceFoundException e){return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","Không tìm thấy đường dẫn yêu cầu"));}
 @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
 public ResponseEntity<Map<String,String>> methodNotAllowed(HttpRequestMethodNotSupportedException e){
  ResponseEntity.BodyBuilder b=ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED);
  Set<HttpMethod> allowed=e.getSupportedHttpMethods();
  if(allowed!=null&&!allowed.isEmpty()) b.allow(allowed.toArray(new HttpMethod[0]));
  return b.body(Map.of("error","Phương thức không được hỗ trợ cho đường dẫn này"));
 }
 @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
 public ResponseEntity<Map<String,String>> unsupportedMedia(HttpMediaTypeNotSupportedException e){return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(Map.of("error","Định dạng dữ liệu không được hỗ trợ, hãy gửi JSON"));}
 @ExceptionHandler(Exception.class)
 public ResponseEntity<Map<String,String>> generic(Exception e){
  log.error("Unhandled exception while processing request",e);
  return ResponseEntity.status(500).body(Map.of("error","Lỗi máy chủ, hãy kiểm tra nhật ký server"));
 }
}
