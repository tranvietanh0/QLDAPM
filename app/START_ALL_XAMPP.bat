@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "QLDAPM XAMPP SERVER" cmd /k ""%~dp0START_SERVER_MYSQL.bat""
start "QLDAPM CLIENT" cmd /k ""%~dp0START_CLIENT.bat""
echo Hai cua so da duoc mo.
echo Bat MySQL trong XAMPP truoc, sau do doi Server bao Tomcat started on port 8081.
echo Truy cap http://localhost:5173
echo Dong cua so nay khong anh huong hai cua so Server/Client.
