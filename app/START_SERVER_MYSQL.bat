@echo off
setlocal
chcp 65001 >nul
for %%I in ("%~dp0") do set "PROJECT_ROOT=%%~sI"
cd /d "%PROJECT_ROOT%backend"
echo === QLDAPM SERVER - XAMPP MySQL - 3306 / API 8081 ===
set "DEBUG=false"
set "XAMPP_MYSQL=C:\xampp\mysql\bin\mysqld.exe"
set "XAMPP_INI=C:\xampp\mysql\bin\my.ini"
if not defined DB_USER set "DB_USER=root"
if not defined DB_URL set "DB_URL=jdbc:mysql://127.0.0.1:3306/intern_management?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Ho_Chi_Minh&characterEncoding=UTF-8"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=New-Object Net.Sockets.TcpClient; try { $t.Connect('127.0.0.1',3306); $t.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  if not exist "%XAMPP_MYSQL%" (
    echo [LOI] Khong tim thay MySQL XAMPP tai C:\xampp. Hay Start MySQL trong XAMPP Control Panel.
    if not defined QLDAPM_NO_PAUSE pause
    exit /b 1
  )
  echo [XAMPP] Dang khoi dong MySQL tren cong 3306...
  powershell -NoProfile -Command "Start-Process -FilePath $env:XAMPP_MYSQL -ArgumentList @(('--defaults-file='+$env:XAMPP_INI), '--standalone') -WorkingDirectory 'C:\xampp' -WindowStyle Hidden"
  powershell -NoProfile -Command "$ready=$false; $deadline=(Get-Date).AddSeconds(30); do { Start-Sleep -Milliseconds 500; $t=New-Object Net.Sockets.TcpClient; try { $t.Connect('127.0.0.1',3306); $ready=$true } catch {} finally { $t.Dispose() } } while (-not $ready -and (Get-Date) -lt $deadline); if ($ready) { exit 0 } else { exit 1 }"
  if errorlevel 1 (
    echo [LOI] MySQL XAMPP khong mo cong 3306. Kiem tra C:\xampp\mysql\data\mysql_error.log
    if not defined QLDAPM_NO_PAUSE pause
    exit /b 1
  )
)
echo [XAMPP] MySQL dang san sang.
if not defined SERVER_PORT set "SERVER_PORT=8081"
powershell -NoProfile -Command "$t=New-Object Net.Sockets.TcpClient; try { $t.Connect('127.0.0.1',[int]$env:SERVER_PORT) } catch { exit 1 } finally { $t.Dispose() }; try { $r=Invoke-RestMethod ('http://127.0.0.1:'+ $env:SERVER_PORT +'/api/health') -TimeoutSec 3; if ($r.service -eq 'intern-management' -and $r.status -eq 'UP' -and $r.database -in @('MySQL','MariaDB')) { exit 0 } } catch {}; exit 2"
if errorlevel 2 (
  echo [LOI] Cong API dang bi chiem boi server cu/H2 hoac ung dung khac. Hay dong server cu roi chay lai.
  if not defined QLDAPM_NO_PAUSE pause
  exit /b 1
)
if not errorlevel 1 (
  echo [SERVER] QLDAPM MySQL da dang chay tren http://localhost:%SERVER_PORT%
  exit /b 0
)
echo [DB] Database intern_management, DB_USER=%DB_USER%
echo [SERVER] Khi thay Started InternManagementApplication, server da san sang va tiep tuc cho request.
call mvn spring-boot:run
set "SERVER_EXIT=%ERRORLEVEL%"
if not "%SERVER_EXIT%"=="0" (
  echo [LOI] Server dung. Kiem tra MySQL, Maven va log ben tren.
  if not defined QLDAPM_NO_PAUSE pause
)
exit /b %SERVER_EXIT%
