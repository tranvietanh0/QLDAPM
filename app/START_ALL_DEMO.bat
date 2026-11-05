@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "QLDAPM SERVER" cmd /k ""%~dp0START_SERVER_DEMO.bat""
start "QLDAPM CLIENT" cmd /k ""%~dp0START_CLIENT.bat""
echo Hai cua so da duoc mo. Khi Server bao Started, truy cap http://localhost:5173
echo Dong cua so nay khong anh huong hai cua so Server/Client.
