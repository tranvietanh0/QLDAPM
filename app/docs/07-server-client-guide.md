# Tách Client / Server – trình diễn trên hai máy

1. **Máy chủ:** chuẩn bị Java 21 + Maven. Tại máy chủ chạy `START_SERVER_DEMO.bat` (H2) hoặc `START_SERVER_MYSQL.bat` (MySQL). Cổng `8081`, host `0.0.0.0`.
2. **Máy Client:** cài Node.js 20+, giải nén source `frontend/`, chạy `npm install` rồi đặt `API_SERVER=http://<IP_SERVER>:8081` và chạy `npm run dev -- --host 0.0.0.0`. Vite sẽ chuyển request `/api` sang Server.
3. Truy cập `http://localhost:5173` trên máy Client; đăng nhập.
4. Tại máy Server quan sát log request, dữ liệu lưu trong CSDL máy Server. Việc đóng client không làm mất phiên/lưu trữ dữ liệu server.

**Windows CMD ví dụ:**
```
set API_SERVER=http://192.168.1.10:8081
cd frontend
npm run dev -- --host 0.0.0.0
```

**Windows PowerShell ví dụ:**
```
$env:API_SERVER='http://192.168.1.10:8081'
cd frontend
npm run dev -- --host 0.0.0.0
```

Nếu frontend trực tiếp truy cập URL Backend (`VITE_API_URL=http://...:8081/api`) thay vì proxy Vite, cần chỉnh `CORS_ORIGINS` ở Server cho đúng origin frontend. Chỉ truy cập trong LAN tin cậy; muốn đưa ra Internet cần SSL, reverse proxy và cấu hình bảo mật.
