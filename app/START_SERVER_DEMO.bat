@echo off
chcp 65001 >nul
for %%I in ("%~dp0") do set "PROJECT_ROOT=%%~sI"
cd /d "%PROJECT_ROOT%backend"
if not exist "pom.xml" (echo [LOI] Khong tim thay backend\pom.xml & pause & exit /b 1)
echo === QLDAPM SERVER - H2 DEMO - 8081 ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue; if ($c) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo Server da dang chay tren http://localhost:8081
  exit /b 0
)
echo Neu lan dau chay Maven can Internet de tai dependency.
call mvn spring-boot:run -Dspring-boot.run.profiles=demo
if errorlevel 1 (echo [LOI] Server dung. Kiem tra Java 21, Maven va log ben tren. & pause)